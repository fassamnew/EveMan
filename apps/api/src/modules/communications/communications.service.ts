import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AuditOutcome, CommunicationChannel, CommunicationDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../../infra/db/prisma.service';
import { getSystemQueue } from '../../infra/queue/queue.provider';
import { AuditService } from '../common/audit.service';
import { PolicyService } from '../common/policy.service';
import type { RequestWithAuth } from '../common/request-with-auth';
import type { CreateBulkSendDto } from './dto/create-bulk-send.dto';
import type { CreateCommunicationTemplateDto } from './dto/create-communication-template.dto';
import type { UpdateCommunicationTemplateDto } from './dto/update-communication-template.dto';
import {
  getTemplateTypeKey,
  TEMPLATE_TYPE_KEY_PREFIX,
  type CommunicationMessageType
} from './communication-message-types';

@Injectable()
export class CommunicationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PolicyService) private readonly policy: PolicyService
  ) {}

  private getIp(req: RequestWithAuth): string | null {
    return req.ip || null;
  }

  private assertReadAccess(orgCode: string, req: RequestWithAuth): void {
    if (!req.auth || !this.policy.canAccessTenant(req.auth, orgCode)) {
      throw new ForbiddenException('Missing tenant access');
    }
  }

  private assertWriteAccess(orgCode: string, req: RequestWithAuth): void {
    if (!req.auth || !this.policy.canManageEventSettings(req.auth, orgCode)) {
      throw new ForbiddenException('ORG_ADMIN role required for communications');
    }
  }

  private async getOrg(orgCode: string): Promise<{ id: string }> {
    const org = await this.prisma.organization.findUnique({
      where: { code: orgCode },
      select: { id: true }
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  private parseTemplateType(value: string): CommunicationMessageType | null {
    return value ? (value as CommunicationMessageType) : null;
  }

  private async getTemplateType(templateId: string): Promise<CommunicationMessageType | null> {
    const row = await this.prisma.migrationMetadata.findUnique({
      where: {
        key: getTemplateTypeKey(templateId)
      },
      select: {
        value: true
      }
    });

    return row ? this.parseTemplateType(row.value) : null;
  }

  private async getTemplateTypeMap(templateIds: string[]): Promise<Map<string, CommunicationMessageType>> {
    if (templateIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.migrationMetadata.findMany({
      where: {
        key: {
          in: templateIds.map(id => getTemplateTypeKey(id))
        }
      },
      select: {
        key: true,
        value: true
      }
    });

    const map = new Map<string, CommunicationMessageType>();
    for (const row of rows) {
      const templateId = row.key.replace(TEMPLATE_TYPE_KEY_PREFIX, '');
      const parsed = this.parseTemplateType(row.value);
      if (parsed) {
        map.set(templateId, parsed);
      }
    }

    return map;
  }

  private async setTemplateType(templateId: string, messageType?: CommunicationMessageType): Promise<void> {
    const key = getTemplateTypeKey(templateId);

    if (!messageType) {
      await this.prisma.migrationMetadata.deleteMany({ where: { key } });
      return;
    }

    await this.prisma.migrationMetadata.upsert({
      where: { key },
      update: { value: messageType },
      create: {
        key,
        value: messageType
      }
    });
  }

  private extractSmsAddress(input: Array<{ fieldKey: string; valueText: string }>): string | null {
    const preferredKeys = ['phone', 'mobile', 'phone_number', 'phoneNumber', 'msisdn'];

    for (const key of preferredKeys) {
      const row = input.find(item => item.fieldKey === key && item.valueText?.trim().length > 0);
      if (row) {
        return row.valueText.trim();
      }
    }

    return null;
  }

  private async findTemplateByMessageType(input: {
    organizationId: string;
    messageType: CommunicationMessageType;
    channel: CommunicationChannel;
  }) {
    const rows = await this.prisma.migrationMetadata.findMany({
      where: {
        key: {
          startsWith: TEMPLATE_TYPE_KEY_PREFIX
        },
        value: input.messageType
      },
      select: {
        key: true
      }
    });

    const candidateIds = rows.map(row => row.key.replace(TEMPLATE_TYPE_KEY_PREFIX, ''));
    if (candidateIds.length === 0) {
      return null;
    }

    return this.prisma.communicationTemplate.findFirst({
      where: {
        id: {
          in: candidateIds
        },
        organizationId: input.organizationId,
        channel: input.channel,
        isActive: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
  }

  async queueAutomatedMessage(input: {
    organizationId: string;
    registrantId: string;
    recipientAddress: string;
    messageType: CommunicationMessageType;
    metadata?: Record<string, unknown>;
  }): Promise<{ queued: boolean; communicationLogId: string | null; templateId: string | null }> {
    const recipient = input.recipientAddress.trim();
    if (!recipient) {
      return {
        queued: false,
        communicationLogId: null,
        templateId: null
      };
    }

    const template = await this.findTemplateByMessageType({
      organizationId: input.organizationId,
      messageType: input.messageType,
      channel: CommunicationChannel.EMAIL
    });

    const log = await this.prisma.communicationLog.create({
      data: {
        organizationId: input.organizationId,
        registrantId: input.registrantId,
        templateId: template?.id || null,
        channel: CommunicationChannel.EMAIL,
        status: CommunicationDeliveryStatus.QUEUED,
        senderUserId: null,
        recipientAddress: recipient,
        metadataJson: {
          messageType: input.messageType,
          ...(input.metadata || {})
        }
      }
    });

    const queue = getSystemQueue();
    await queue.add(
      'communication.send',
      {
        communicationLogId: log.id
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: 100,
        removeOnFail: 100
      }
    );

    return {
      queued: true,
      communicationLogId: log.id,
      templateId: template?.id || null
    };
  }

  async createTemplate(input: {
    orgCode: string;
    dto: CreateCommunicationTemplateDto;
    req: RequestWithAuth;
  }) {
    this.assertWriteAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);

    const created = await this.prisma.communicationTemplate.create({
      data: {
        organizationId: org.id,
        name: input.dto.name,
        channel: input.dto.channel as CommunicationChannel,
        subject: input.dto.subject,
        body: input.dto.body,
        isActive: true,
        createdByUserId: input.req.auth?.userId || null
      }
    });

    await this.setTemplateType(created.id, input.dto.messageType);

    await this.audit.write({
      actorUserId: input.req.auth?.userId || null,
      organizationId: org.id,
      action: 'COMM_TEMPLATE_CREATE',
      targetType: 'COMMUNICATION_TEMPLATE',
      targetId: created.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getIp(input.req)
    });

    return {
      ...created,
      messageType: input.dto.messageType || null
    };
  }

  async listTemplates(input: { orgCode: string; req: RequestWithAuth }) {
    this.assertReadAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);

    const templates = await this.prisma.communicationTemplate.findMany({
      where: {
        organizationId: org.id
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    const typeMap = await this.getTemplateTypeMap(templates.map(item => item.id));

    return templates.map(item => ({
      ...item,
      messageType: typeMap.get(item.id) || null
    }));
  }

  async updateTemplate(input: {
    orgCode: string;
    templateId: string;
    dto: UpdateCommunicationTemplateDto;
    req: RequestWithAuth;
  }) {
    this.assertWriteAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);

    const template = await this.prisma.communicationTemplate.findFirst({
      where: {
        id: input.templateId,
        organizationId: org.id
      }
    });

    if (!template) {
      throw new NotFoundException('Communication template not found');
    }

    const updated = await this.prisma.communicationTemplate.update({
      where: {
        id: template.id
      },
      data: {
        name: input.dto.name,
        channel: input.dto.channel as CommunicationChannel | undefined,
        subject: input.dto.subject,
        body: input.dto.body,
        isActive: input.dto.isActive
      }
    });

    if (Object.prototype.hasOwnProperty.call(input.dto, 'messageType')) {
      await this.setTemplateType(updated.id, input.dto.messageType);
    }

    const messageType = await this.getTemplateType(updated.id);

    await this.audit.write({
      actorUserId: input.req.auth?.userId || null,
      organizationId: org.id,
      action: 'COMM_TEMPLATE_UPDATE',
      targetType: 'COMMUNICATION_TEMPLATE',
      targetId: updated.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getIp(input.req)
    });

    return {
      ...updated,
      messageType
    };
  }

  async bulkSend(input: {
    orgCode: string;
    dto: CreateBulkSendDto;
    req: RequestWithAuth;
  }) {
    this.assertWriteAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);

    const scheduledAt = input.dto.sendAt ? new Date(input.dto.sendAt) : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid sendAt datetime');
    }

    if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('sendAt must be in the future');
    }

    const delayMs = scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0;

    const template = await this.prisma.communicationTemplate.findFirst({
      where: {
        id: input.dto.templateId,
        organizationId: org.id,
        isActive: true
      }
    });

    if (!template) {
      throw new NotFoundException('Communication template not found');
    }

    const templateType = await this.getTemplateType(template.id);

    const attendees = await this.prisma.registrant.findMany({
      where: {
        organizationId: org.id,
        lifecycleStatus: 'APPROVED',
        id: input.dto.attendeeIds?.length
          ? {
              in: input.dto.attendeeIds
            }
          : undefined
      },
      select: {
        id: true,
        email: true,
        responses: {
          where: {
            fieldKey: {
              in: ['phone', 'mobile', 'phone_number', 'phoneNumber', 'msisdn']
            }
          },
          select: {
            fieldKey: true,
            valueText: true
          }
        }
      }
    });

    const queue = getSystemQueue();
    const jobs = [] as string[];
    let skipped = 0;

    for (const attendee of attendees) {
      const recipientAddress =
        template.channel === CommunicationChannel.EMAIL
          ? attendee.email
          : this.extractSmsAddress(attendee.responses || []);

      if (!recipientAddress) {
        skipped += 1;
        continue;
      }

      const log = await this.prisma.communicationLog.create({
        data: {
          organizationId: org.id,
          registrantId: attendee.id,
          templateId: template.id,
          channel: template.channel,
          status: CommunicationDeliveryStatus.QUEUED,
          senderUserId: input.req.auth?.userId || null,
          recipientAddress,
          metadataJson: {
            templateName: template.name,
            scheduledFor: scheduledAt?.toISOString() || null,
            messageType: templateType
          }
        }
      });

      await queue.add(
        'communication.send',
        {
          communicationLogId: log.id
        },
        {
          delay: delayMs,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000
          },
          removeOnComplete: 100,
          removeOnFail: 100
        }
      );

      jobs.push(log.id);
    }

    await this.audit.write({
      actorUserId: input.req.auth?.userId || null,
      organizationId: org.id,
      action: 'COMM_BULK_SEND_QUEUE',
      targetType: 'COMMUNICATION_TEMPLATE',
      targetId: template.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getIp(input.req),
      metadataJson: {
        queued: jobs.length,
        skipped
      }
    });

    return {
      templateId: template.id,
      queued: jobs.length,
      skipped,
      scheduledFor: scheduledAt?.toISOString() || null
    };
  }

  async listLogs(input: { orgCode: string; req: RequestWithAuth }) {
    this.assertReadAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);

    return this.prisma.communicationLog.findMany({
      where: {
        organizationId: org.id
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            channel: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 200
    });
  }
}
