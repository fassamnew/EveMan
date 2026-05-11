import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AuditOutcome, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../../infra/db/prisma.service';
import { getBadgeRenderMetricsSnapshot } from '../../infra/queue/badge-render.metrics';
import { getSystemQueue } from '../../infra/queue/queue.provider';
import {
  createBadgeSignedDownloadUrl,
  isValidLocalBadgeSignature,
  readLocalBadgeArtifact
} from '../../infra/storage/badge-storage.util';
import { AuditService } from '../common/audit.service';
import { PolicyService } from '../common/policy.service';
import type { RequestWithAuth } from '../common/request-with-auth';
import type { CreateBadgeTemplateDto } from './dto/create-badge-template.dto';
import type { UpdateBadgeTemplateDto } from './dto/update-badge-template.dto';

type QrPayload = {
  v: 1;
  jti: string;
  r: string;
  e: string;
  o: string;
  l: string;
  iat: number;
  exp: number;
};

@Injectable()
export class BadgeQrService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PolicyService) private readonly policy: PolicyService
  ) {}

  private getQrSecret(): string {
    return process.env.QR_SIGNING_SECRET || process.env.JWT_ACCESS_SECRET || 'dev-qr-secret';
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseExpiresSeconds(value?: string): number {
    const parsed = value ? Number(value) : 300;
    if (!Number.isFinite(parsed) || parsed < 60 || parsed > 900) {
      return 300;
    }
    return Math.floor(parsed);
  }

  private assertTenantReadAccess(orgCode: string, req: RequestWithAuth): void {
    if (!req.auth || !this.policy.canAccessTenant(req.auth, orgCode)) {
      throw new ForbiddenException('Missing tenant access');
    }
  }

  private assertTemplateWriteAccess(orgCode: string, req: RequestWithAuth): void {
    if (!req.auth || !this.policy.canManageEventSettings(req.auth, orgCode)) {
      throw new ForbiddenException('ORG_ADMIN role required to manage templates');
    }
  }

  private toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private async getOrganizationId(orgCode: string): Promise<string> {
    const org = await this.prisma.organization.findUnique({
      where: { code: orgCode },
      select: { id: true }
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org.id;
  }

  async createTemplate(input: {
    orgCode: string;
    dto: CreateBadgeTemplateDto;
    req: RequestWithAuth;
  }) {
    this.assertTemplateWriteAccess(input.orgCode, input.req);
    const organizationId = await this.getOrganizationId(input.orgCode);

    return this.prisma.badgeTemplate.create({
      data: {
        organizationId,
        name: input.dto.name,
        version: input.dto.version || 1,
        configJson: this.toJsonValue(input.dto.configJson),
        isActive: true
      }
    });
  }

  async listTemplates(input: { orgCode: string; req: RequestWithAuth }) {
    this.assertTenantReadAccess(input.orgCode, input.req);
    const organizationId = await this.getOrganizationId(input.orgCode);

    return this.prisma.badgeTemplate.findMany({
      where: {
        organizationId
      },
      orderBy: [
        { updatedAt: 'desc' },
        { version: 'desc' }
      ]
    });
  }

  async updateTemplate(input: {
    orgCode: string;
    templateId: string;
    dto: UpdateBadgeTemplateDto;
    req: RequestWithAuth;
  }) {
    this.assertTemplateWriteAccess(input.orgCode, input.req);
    const organizationId = await this.getOrganizationId(input.orgCode);

    const existing = await this.prisma.badgeTemplate.findFirst({
      where: {
        id: input.templateId,
        organizationId
      }
    });

    if (!existing) {
      throw new NotFoundException('Badge template not found');
    }

    return this.prisma.badgeTemplate.update({
      where: { id: existing.id },
      data: {
        name: input.dto.name,
        version: input.dto.version,
        configJson: input.dto.configJson ? this.toJsonValue(input.dto.configJson) : undefined,
        isActive: input.dto.isActive
      }
    });
  }

  async disableTemplate(input: {
    orgCode: string;
    templateId: string;
    req: RequestWithAuth;
  }) {
    this.assertTemplateWriteAccess(input.orgCode, input.req);
    const organizationId = await this.getOrganizationId(input.orgCode);

    const existing = await this.prisma.badgeTemplate.findFirst({
      where: {
        id: input.templateId,
        organizationId
      }
    });

    if (!existing) {
      throw new NotFoundException('Badge template not found');
    }

    return this.prisma.badgeTemplate.update({
      where: { id: existing.id },
      data: {
        isActive: false
      }
    });
  }

  async assignTemplateToLink(input: {
    orgCode: string;
    linkId: string;
    templateId: string;
  }) {
    const org = await this.prisma.organization.findUnique({ where: { code: input.orgCode } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const template = await this.prisma.badgeTemplate.findFirst({
      where: {
        id: input.templateId,
        organizationId: org.id,
        isActive: true
      }
    });

    if (!template) {
      throw new NotFoundException('Badge template not found');
    }

    const link = await this.prisma.registrationLink.findFirst({
      where: {
        id: input.linkId,
        organizationId: org.id
      }
    });

    if (!link) {
      throw new NotFoundException('Registration link not found');
    }

    return this.prisma.registrationLink.update({
      where: { id: link.id },
      data: { badgeTemplateId: template.id }
    });
  }

  async issueForRegistrant(input: { registrantId: string }) {
    const registrant = await this.prisma.registrant.findUnique({
      where: { id: input.registrantId },
      include: {
        registrationLink: {
          select: {
            id: true,
            badgeTemplateId: true,
            title: true
          }
        }
      }
    });

    if (!registrant) {
      throw new NotFoundException('Registrant not found');
    }

    const qrCode = await this.prisma.qrCode.create({
      data: {
        registrantId: registrant.id,
        organizationId: registrant.organizationId,
        eventId: registrant.eventId,
        status: 'ACTIVE'
      }
    });

    const nowSeconds = Math.floor(Date.now() / 1000);
    const payload: QrPayload = {
      v: 1,
      jti: qrCode.id,
      r: registrant.id,
      e: registrant.eventId,
      o: registrant.organizationId,
      l: registrant.registrationLinkId,
      iat: nowSeconds,
      exp: nowSeconds + 60 * 60 * 24 * 30
    };

    const token = jwt.sign(payload, this.getQrSecret());
    const tokenHash = this.hashToken(token);

    await this.prisma.qrCode.update({
      where: { id: qrCode.id },
      data: {
        tokenHash,
        expiresAt: new Date(payload.exp * 1000)
      }
    });

    const badge = await this.prisma.badge.create({
      data: {
        registrantId: registrant.id,
        organizationId: registrant.organizationId,
        eventId: registrant.eventId,
        registrationLinkId: registrant.registrationLinkId,
        badgeTemplateId: registrant.registrationLink.badgeTemplateId,
        qrCodeId: qrCode.id,
        status: 'PENDING'
      }
    });

    const queue = getSystemQueue();
    await queue.add(
      'badge.render',
      { badgeId: badge.id },
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

    await this.audit.write({
      actorUserId: null,
      organizationId: registrant.organizationId,
      action: 'BADGE_ISSUE',
      targetType: 'BADGE',
      targetId: badge.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: null,
      metadataJson: {
        qrCodeId: qrCode.id,
        templateId: registrant.registrationLink.badgeTemplateId
      }
    });

    return {
      badgeId: badge.id,
      qrToken: token,
      status: badge.status
    };
  }

  async regenerateBadge(input: { orgCode: string; registrantId: string }) {
    const org = await this.prisma.organization.findUnique({ where: { code: input.orgCode } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const registrant = await this.prisma.registrant.findFirst({
      where: {
        id: input.registrantId,
        organizationId: org.id
      }
    });

    if (!registrant) {
      throw new NotFoundException('Registrant not found');
    }

    const latest = await this.prisma.badge.findFirst({
      where: {
        registrantId: registrant.id,
        organizationId: org.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!latest) {
      throw new NotFoundException('Badge not found');
    }

    const updated = await this.prisma.badge.update({
      where: { id: latest.id },
      data: {
        status: 'PENDING',
        renderedAt: null,
        deliveredAt: null,
        storagePath: null,
        failureReason: null
      }
    });

    const queue = getSystemQueue();
    await queue.add(
      'badge.render',
      { badgeId: updated.id },
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
      badgeId: updated.id,
      status: updated.status
    };
  }

  async getBadgeDownloadUrl(input: {
    orgCode: string;
    registrantId: string;
    expiresInSeconds?: string;
  }) {
    const org = await this.prisma.organization.findUnique({ where: { code: input.orgCode } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const badge = await this.prisma.badge.findFirst({
      where: {
        organizationId: org.id,
        registrantId: input.registrantId,
        status: 'READY',
        storagePath: {
          not: null
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    if (!badge || !badge.storagePath) {
      throw new NotFoundException('Ready badge not found');
    }

    const expiresIn = this.parseExpiresSeconds(input.expiresInSeconds);
    const downloadUrl = await createBadgeSignedDownloadUrl({
      storagePath: badge.storagePath,
      expiresInSeconds: expiresIn
    });

    return {
      badgeId: badge.id,
      expiresInSeconds: expiresIn,
      downloadUrl
    };
  }

  async getRendererMetrics(input: { orgCode: string; req: RequestWithAuth }) {
    this.assertTenantReadAccess(input.orgCode, input.req);
    const organizationId = await this.getOrganizationId(input.orgCode);

    return {
      organizationId,
      metrics: getBadgeRenderMetricsSnapshot()
    };
  }

  async getLocalBadgeDownload(input: {
    path: string;
    expires: string;
    sig: string;
  }) {
    const expiresAtMs = Number(input.expires);
    if (!Number.isFinite(expiresAtMs)) {
      throw new BadRequestException('Invalid expires value');
    }

    const valid = isValidLocalBadgeSignature({
      storagePath: input.path,
      expiresAtMs,
      signature: input.sig
    });

    if (!valid) {
      throw new BadRequestException('Invalid or expired badge download signature');
    }

    const content = await readLocalBadgeArtifact(input.path);
    return {
      filename: input.path.split('/').pop() || 'badge.txt',
      content
    };
  }

  async verifyQr(token: string) {
    let decoded: QrPayload;

    try {
      decoded = jwt.verify(token, this.getQrSecret()) as QrPayload;
    } catch {
      throw new BadRequestException({
        status: 'INVALID',
        reason: 'TOKEN_SIGNATURE_INVALID'
      });
    }

    if (decoded.v !== 1 || !decoded.jti || !decoded.r || !decoded.e || !decoded.o) {
      throw new BadRequestException({
        status: 'INVALID',
        reason: 'TOKEN_PAYLOAD_INVALID'
      });
    }

    const tokenHash = this.hashToken(token);
    const qr = await this.prisma.qrCode.findUnique({
      where: { id: decoded.jti },
      include: {
        registrant: {
          select: {
            id: true,
            fullName: true,
            registrationLinkId: true,
            event: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!qr) {
      throw new NotFoundException({
        status: 'INVALID',
        reason: 'TOKEN_NOT_FOUND'
      });
    }

    if (qr.tokenHash !== tokenHash) {
      throw new BadRequestException({
        status: 'INVALID',
        reason: 'TOKEN_HASH_MISMATCH'
      });
    }

    if (decoded.l !== qr.registrant.registrationLinkId) {
      throw new BadRequestException({
        status: 'INVALID',
        reason: 'TOKEN_LINK_MISMATCH'
      });
    }

    if (qr.status !== 'ACTIVE') {
      throw new BadRequestException({
        status: 'INVALID',
        reason: qr.status === 'REVOKED' ? 'TOKEN_REVOKED' : 'TOKEN_INACTIVE'
      });
    }

    if (qr.expiresAt && qr.expiresAt.getTime() < Date.now()) {
      await this.prisma.qrCode.update({
        where: { id: qr.id },
        data: {
          status: 'EXPIRED'
        }
      });

      throw new BadRequestException({
        status: 'INVALID',
        reason: 'TOKEN_EXPIRED'
      });
    }

    await this.prisma.qrCode.update({
      where: { id: qr.id },
      data: {
        lastVerifiedAt: new Date(),
        status: 'VERIFIED'
      }
    });

    return {
      status: 'VALID',
      registrant: {
        id: qr.registrant.id,
        name: qr.registrant.fullName
      },
      event: qr.registrant.event
    };
  }
}
