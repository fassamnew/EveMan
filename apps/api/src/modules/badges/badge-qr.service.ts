import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AuditOutcome } from '@prisma/client';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../../infra/db/prisma.service';
import { getSystemQueue } from '../../infra/queue/queue.provider';
import {
  createBadgeSignedDownloadUrl,
  isValidLocalBadgeSignature,
  readLocalBadgeArtifact
} from '../../infra/storage/badge-storage.util';
import { AuditService } from '../common/audit.service';

type QrPayload = {
  v: 1;
  jti: string;
  r: string;
  e: string;
  o: string;
  iat: number;
  exp: number;
};

@Injectable()
export class BadgeQrService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
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
