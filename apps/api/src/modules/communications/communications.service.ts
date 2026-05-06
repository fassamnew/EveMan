import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { CommunicationChannel, CommunicationDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../../infra/db/prisma.service';
import { getSystemQueue } from '../../infra/queue/queue.provider';
import { PolicyService } from '../common/policy.service';
import type { RequestWithAuth } from '../common/request-with-auth';
import type { CreateBulkSendDto } from './dto/create-bulk-send.dto';
import type { CreateCommunicationTemplateDto } from './dto/create-communication-template.dto';
import type { UpdateCommunicationTemplateDto } from './dto/update-communication-template.dto';

@Injectable()
export class CommunicationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PolicyService) private readonly policy: PolicyService
  ) {}

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

  async createTemplate(input: {
    orgCode: string;
    dto: CreateCommunicationTemplateDto;
    req: RequestWithAuth;
  }) {
    this.assertWriteAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);

    return this.prisma.communicationTemplate.create({
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
  }

  async listTemplates(input: { orgCode: string; req: RequestWithAuth }) {
    this.assertReadAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);

    return this.prisma.communicationTemplate.findMany({
      where: {
        organizationId: org.id
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
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

    return this.prisma.communicationTemplate.update({
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
  }

  async bulkSend(input: {
    orgCode: string;
    dto: CreateBulkSendDto;
    req: RequestWithAuth;
  }) {
    this.assertWriteAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);

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
        email: true
      }
    });

    const queue = getSystemQueue();
    const jobs = [] as string[];

    for (const attendee of attendees) {
      const log = await this.prisma.communicationLog.create({
        data: {
          organizationId: org.id,
          registrantId: attendee.id,
          templateId: template.id,
          channel: template.channel,
          status: CommunicationDeliveryStatus.QUEUED,
          senderUserId: input.req.auth?.userId || null,
          recipientAddress: template.channel === 'EMAIL' ? attendee.email : attendee.email,
          metadataJson: {
            templateName: template.name
          }
        }
      });

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

      jobs.push(log.id);
    }

    return {
      templateId: template.id,
      queued: jobs.length
    };
  }

  async listLogs(input: { orgCode: string; req: RequestWithAuth }) {
    this.assertReadAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);

    return this.prisma.communicationLog.findMany({
      where: {
        organizationId: org.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 200
    });
  }
}
