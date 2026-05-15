import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { AuditOutcome, CheckinSource, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../../infra/db/prisma.service';
import { AuditService } from '../common/audit.service';
import type { RequestWithAuth } from '../common/request-with-auth';
import type { CreateCheckinDto } from './dto/create-checkin.dto';
import type { SearchAttendeesDto } from './dto/search-attendees.dto';

type QrPayload = {
  v: 1;
  jti: string;
  r: string;
  e: string;
  o: string;
  l?: string;
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

  private normalizeZone(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const next = value.trim().toLowerCase();
    return next.length > 0 ? next : null;
  }

  private getCandidateZones(input: {
    registrationLinkTitle: string;
    linkTypeName: string | null;
    responses: Array<{ fieldKey: string; valueText: string }>;
  }): string[] {
    const zoneKeys = new Set(['accesszone', 'access_level', 'accesslevel', 'zone', 'category']);
    const candidates = [input.registrationLinkTitle, input.linkTypeName || ''];

    for (const response of input.responses) {
      if (zoneKeys.has(response.fieldKey.trim().toLowerCase())) {
        candidates.push(response.valueText);
      }
    }

    return candidates
      .map(item => this.normalizeZone(item))
      .filter((item): item is string => Boolean(item));
  }

  private buildRegistrantSnapshot(input: {
    id: string;
    fullName: string;
    email: string;
    referenceCode: string;
    registrationLinkTitle: string;
    responses: Array<{ fieldKey: string; valueText: string }>;
  }) {
    const photo = input.responses.find(item => item.fieldKey === '__photo_upload__')?.valueText || null;

    return {
      id: input.id,
      name: input.fullName,
      email: input.email,
      referenceCode: input.referenceCode,
      category: input.registrationLinkTitle,
      photoUrl: photo
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

  async searchAttendees(input: { dto: SearchAttendeesDto; req: RequestWithAuth }) {
    const auth = this.requireUsherAccess(input.req);
    const query = input.dto.q.trim();

    const attendees = await this.prisma.registrant.findMany({
      where: {
        organizationId: auth.organizationId,
        eventId: input.dto.eventId,
        OR: [
          { fullName: { contains: query } },
          { email: { contains: query } },
          { referenceCode: { contains: query } },
          {
            responses: {
              some: {
                valueText: { contains: query }
              }
            }
          }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 25,
      include: {
        event: {
          select: {
            id: true,
            name: true
          }
        },
        registrationLink: {
          select: {
            id: true,
            title: true
          }
        },
        responses: {
          where: {
            fieldKey: '__photo_upload__'
          },
          take: 1,
          select: {
            valueText: true
          }
        },
        checkins: {
          orderBy: {
            scannedAt: 'desc'
          },
          take: 1,
          select: {
            id: true,
            scannedAt: true
          }
        }
      }
    });

    return {
      items: attendees.map(item => ({
        id: item.id,
        referenceCode: item.referenceCode,
        fullName: item.fullName,
        email: item.email,
        lifecycleStatus: item.lifecycleStatus,
        event: item.event,
        category: item.registrationLink.title,
        photoUrl: item.responses[0]?.valueText || null,
        checkin: item.checkins[0]
          ? {
              status: 'ALREADY_CHECKED_IN',
              checkinId: item.checkins[0].id,
              scannedAt: item.checkins[0].scannedAt
            }
          : {
              status: 'NOT_CHECKED_IN'
            }
      }))
    };
  }

  async createCheckin(input: { dto: CreateCheckinDto; req: RequestWithAuth }) {
    const auth = this.requireUsherAccess(input.req);

    const writeInvalidAudit = async (reason: string, metadata?: Record<string, unknown>) => {
      await this.audit.write({
        actorUserId: auth.userId,
        organizationId: auth.organizationId,
        action: 'USHER_CHECKIN_INVALID',
        targetType: 'CHECKIN',
        targetId: null,
        outcome: AuditOutcome.FAILURE,
        ipAddress: this.getIp(input.req),
        metadataJson: {
          reason,
          idempotencyKey: input.dto.idempotencyKey,
          ...(metadata || {})
        } as Prisma.InputJsonValue
      });
    };

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
      await writeInvalidAudit('TOKEN_SIGNATURE_INVALID');
      throw new BadRequestException({ status: 'INVALID', reason: 'TOKEN_SIGNATURE_INVALID' });
    }

    if (!decoded.jti || !decoded.r || !decoded.e || !decoded.o) {
      await writeInvalidAudit('TOKEN_PAYLOAD_INVALID');
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
            email: true,
            referenceCode: true,
            organizationId: true,
            eventId: true,
            registrationLink: {
              select: {
                title: true,
                linkType: {
                  select: {
                    name: true
                  }
                }
              }
            },
            responses: {
              where: {
                OR: [{ fieldKey: '__photo_upload__' }, { fieldKey: 'accessZone' }, { fieldKey: 'access_level' }, { fieldKey: 'accessLevel' }, { fieldKey: 'zone' }, { fieldKey: 'category' }]
              },
              select: {
                fieldKey: true,
                valueText: true
              }
            },
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
      await writeInvalidAudit('TOKEN_NOT_FOUND', {
        eventId: decoded.e || null,
        registrantId: decoded.r || null
      });
      throw new BadRequestException({ status: 'INVALID', reason: 'TOKEN_NOT_FOUND' });
    }

    if (qr.status === 'REVOKED' || qr.status === 'EXPIRED') {
      await writeInvalidAudit('TOKEN_INACTIVE', {
        eventId: qr.registrant.eventId,
        registrantId: qr.registrant.id
      });
      throw new BadRequestException({ status: 'INVALID', reason: 'TOKEN_INACTIVE' });
    }

    if (qr.expiresAt && qr.expiresAt.getTime() < Date.now()) {
      await writeInvalidAudit('TOKEN_EXPIRED', {
        eventId: qr.registrant.eventId,
        registrantId: qr.registrant.id
      });
      throw new BadRequestException({ status: 'INVALID', reason: 'TOKEN_EXPIRED' });
    }

    if (qr.registrant.organizationId !== auth.organizationId) {
      return {
        status: 'ACCESS_DENIED',
        reason: 'ORGANIZATION_MISMATCH'
      };
    }

    if (input.dto.selectedEventId && input.dto.selectedEventId !== qr.registrant.eventId) {
      return {
        status: 'WRONG_EVENT',
        registrant: this.buildRegistrantSnapshot({
          id: qr.registrant.id,
          fullName: qr.registrant.fullName,
          email: qr.registrant.email,
          referenceCode: qr.registrant.referenceCode,
          registrationLinkTitle: qr.registrant.registrationLink.title,
          responses: qr.registrant.responses
        }),
        event: {
          id: qr.registrant.eventId,
          name: qr.registrant.event.name
        }
      };
    }

    const requestedZone = this.normalizeZone(input.dto.accessZone);
    if (requestedZone) {
      const allowedZones = this.getCandidateZones({
        registrationLinkTitle: qr.registrant.registrationLink.title,
        linkTypeName: qr.registrant.registrationLink.linkType?.name || null,
        responses: qr.registrant.responses
      });

      if (!allowedZones.includes(requestedZone)) {
        return {
          status: 'ACCESS_DENIED',
          reason: 'ZONE_RESTRICTED',
          registrant: this.buildRegistrantSnapshot({
            id: qr.registrant.id,
            fullName: qr.registrant.fullName,
            email: qr.registrant.email,
            referenceCode: qr.registrant.referenceCode,
            registrationLinkTitle: qr.registrant.registrationLink.title,
            responses: qr.registrant.responses
          })
        };
      }
    }

    const registrantStatus = await this.prisma.registrant.findUnique({
      where: {
        id: qr.registrant.id
      },
      select: {
        lifecycleStatus: true
      }
    });

    if (!registrantStatus || registrantStatus.lifecycleStatus !== 'APPROVED') {
      return {
        status: 'NOT_APPROVED',
        reason: registrantStatus?.lifecycleStatus || 'UNKNOWN',
        registrant: this.buildRegistrantSnapshot({
          id: qr.registrant.id,
          fullName: qr.registrant.fullName,
          email: qr.registrant.email,
          referenceCode: qr.registrant.referenceCode,
          registrationLinkTitle: qr.registrant.registrationLink.title,
          responses: qr.registrant.responses
        })
      };
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
        registrant: this.buildRegistrantSnapshot({
          id: qr.registrant.id,
          fullName: qr.registrant.fullName,
          email: qr.registrant.email,
          referenceCode: qr.registrant.referenceCode,
          registrationLinkTitle: qr.registrant.registrationLink.title,
          responses: qr.registrant.responses
        }),
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

    const persistedSource = input.dto.source === 'MOBILE_OFFLINE' ? 'OFFLINE_SYNC' : input.dto.source;

    const created = await this.prisma.checkin.create({
      data: {
        organizationId: auth.organizationId,
        eventId: qr.registrant.eventId,
        registrantId: qr.registrant.id,
        usherUserId: auth.userId,
        deviceId: input.dto.deviceId,
        idempotencyKey: input.dto.idempotencyKey,
        source: (persistedSource || 'MOBILE_ONLINE') as CheckinSource,
        syncState: 'ACCEPTED',
        entrance: input.dto.entrance || null,
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
      registrant: this.buildRegistrantSnapshot({
        id: qr.registrant.id,
        fullName: qr.registrant.fullName,
        email: qr.registrant.email,
        referenceCode: qr.registrant.referenceCode,
        registrationLinkTitle: qr.registrant.registrationLink.title,
        responses: qr.registrant.responses
      }),
      event: {
        id: qr.registrant.eventId,
        name: qr.registrant.event.name
      }
    };
   }
 }
