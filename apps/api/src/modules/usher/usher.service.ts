import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { AuditOutcome, CheckinSource, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../../infra/db/prisma.service';
import { AuditService } from '../common/audit.service';
import type { RequestWithAuth } from '../common/request-with-auth';
import type { CreateCheckinDto } from './dto/create-checkin.dto';

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
export class UsherService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  private getIp(req: RequestWithAuth): string | null {
    return req.ip || null;
  }

  private getQrSecret(): string {
    return process.env.QR_SIGNING_SECRET || process.env.JWT_ACCESS_SECRET || 'dev-qr-secret';
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private requireUsherAccess(req: RequestWithAuth): { userId: string; organizationId: string } {
    if (!req.auth) {
      throw new ForbiddenException('Missing auth context');
    }

    const canScan =
      req.auth.roles.includes('SUPER_ADMIN') ||
      req.auth.roles.includes('ORG_ADMIN') ||
      req.auth.roles.includes('ORG_STAFF');

    if (!canScan) {
      throw new ForbiddenException('Usher access requires ORG_STAFF or ORG_ADMIN');
    }

    if (!req.auth.organizationId) {
      throw new ForbiddenException('Organization-scoped login required for usher scanning');
    }

    return {
      userId: req.auth.userId,
      organizationId: req.auth.organizationId
    };
  }

  async listAssignments(input: { req: RequestWithAuth }) {
    const auth = this.requireUsherAccess(input.req);

    const events = await this.prisma.event.findMany({
      where: {
        organizationId: auth.organizationId,
        status: 'PUBLISHED'
      },
      orderBy: {
        startsAt: 'asc'
      },
      select: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true,
        status: true
      }
    });

    return {
      organizationId: auth.organizationId,
      events
    };
  }

  async createCheckin(input: { dto: CreateCheckinDto; req: RequestWithAuth }) {
    const auth = this.requireUsherAccess(input.req);

    const existingByKey = await this.prisma.checkin.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: auth.organizationId,
          idempotencyKey: input.dto.idempotencyKey
        }
      }
    });

    if (existingByKey) {
      return {
        status: 'IDEMPOTENT_REPLAY',
        checkinId: existingByKey.id,
        eventId: existingByKey.eventId,
        registrantId: existingByKey.registrantId
      };
    }

    let decoded: QrPayload;
    try {
      decoded = jwt.verify(input.dto.token, this.getQrSecret()) as QrPayload;
    } catch {
      throw new BadRequestException({ status: 'INVALID', reason: 'TOKEN_SIGNATURE_INVALID' });
    }

    if (!decoded.jti || !decoded.r || !decoded.e || !decoded.o) {
      throw new BadRequestException({ status: 'INVALID', reason: 'TOKEN_PAYLOAD_INVALID' });
    }

    const tokenHash = this.hashToken(input.dto.token);
    const qr = await this.prisma.qrCode.findUnique({
      where: { id: decoded.jti },
      include: {
        registrant: {
          select: {
            id: true,
            fullName: true,
            organizationId: true,
            eventId: true,
            event: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!qr || qr.tokenHash !== tokenHash) {
      throw new BadRequestException({ status: 'INVALID', reason: 'TOKEN_NOT_FOUND' });
    }

    if (qr.status === 'REVOKED' || qr.status === 'EXPIRED') {
      throw new BadRequestException({ status: 'INVALID', reason: 'TOKEN_INACTIVE' });
    }

    if (qr.expiresAt && qr.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({ status: 'INVALID', reason: 'TOKEN_EXPIRED' });
    }

    if (qr.registrant.organizationId !== auth.organizationId) {
      throw new ForbiddenException('Token organization mismatch');
    }

    const duplicate = await this.prisma.checkin.findUnique({
      where: {
        eventId_registrantId: {
          eventId: qr.registrant.eventId,
          registrantId: qr.registrant.id
        }
      }
    });

    if (duplicate) {
      await this.audit.write({
        actorUserId: auth.userId,
        organizationId: auth.organizationId,
        action: 'USHER_CHECKIN_DUPLICATE',
        targetType: 'REGISTRANT',
        targetId: qr.registrant.id,
        outcome: AuditOutcome.FAILURE,
        ipAddress: this.getIp(input.req),
        metadataJson: {
          eventId: qr.registrant.eventId,
          duplicateCheckinId: duplicate.id,
          idempotencyKey: input.dto.idempotencyKey
        } as Prisma.InputJsonValue
      });

      return {
        status: 'DUPLICATE',
        checkinId: duplicate.id,
        registrant: {
          id: qr.registrant.id,
          name: qr.registrant.fullName
        },
        event: {
          id: qr.registrant.eventId,
          name: qr.registrant.event.name
        }
      };
    }

    const scannedAt = input.dto.scannedAt ? new Date(input.dto.scannedAt) : new Date();
    if (Number.isNaN(scannedAt.getTime())) {
      throw new BadRequestException('Invalid scannedAt timestamp');
    }

    const created = await this.prisma.checkin.create({
      data: {
        organizationId: auth.organizationId,
        eventId: qr.registrant.eventId,
        registrantId: qr.registrant.id,
        usherUserId: auth.userId,
        deviceId: input.dto.deviceId,
        idempotencyKey: input.dto.idempotencyKey,
        source: (input.dto.source || 'MOBILE_ONLINE') as CheckinSource,
        syncState: 'ACCEPTED',
        scannedAt
      }
    });

    await this.audit.write({
      actorUserId: auth.userId,
      organizationId: auth.organizationId,
      action: 'USHER_CHECKIN_ACCEPTED',
      targetType: 'REGISTRANT',
      targetId: qr.registrant.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getIp(input.req),
      metadataJson: {
        checkinId: created.id,
        eventId: qr.registrant.eventId,
        source: created.source,
        deviceId: created.deviceId
      } as Prisma.InputJsonValue
    });

    return {
      status: 'ACCEPTED',
      checkinId: created.id,
      registrant: {
        id: qr.registrant.id,
        name: qr.registrant.fullName
      },
      event: {
        id: qr.registrant.eventId,
        name: qr.registrant.event.name
      }
    };
   }
 }
