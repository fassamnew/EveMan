import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AuditOutcome, AttendeeLifecycleStatus } from '@prisma/client';
import { PrismaService } from '../../infra/db/prisma.service';
import { getSystemQueue } from '../../infra/queue/queue.provider';
import { BadgeQrService } from '../badges/badge-qr.service';
import { AuditService } from '../common/audit.service';
import { PolicyService } from '../common/policy.service';
import type { RequestWithAuth } from '../common/request-with-auth';
import { CommunicationsService } from '../communications/communications.service';
import type { ListAttendeesDto } from './dto/list-attendees.dto';
import type { UpdateAttendeeDto } from './dto/update-attendee.dto';
import type { ListAttendeeCommunicationsDto } from './dto/list-attendee-communications.dto';
import type { OnsiteRegistrationDto } from './dto/onsite-registration.dto';

@Injectable()
export class AttendeesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PolicyService) private readonly policy: PolicyService,
    @Inject(BadgeQrService) private readonly badgeQrService: BadgeQrService,
    @Inject(CommunicationsService) private readonly communicationsService: CommunicationsService
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private getIp(req: RequestWithAuth): string | null {
    return req.ip || null;
  }

  private assertReadAccess(orgCode: string, req: RequestWithAuth): void {
    if (!req.auth || !this.policy.canAccessTenant(req.auth, orgCode)) {
      throw new ForbiddenException('Missing tenant access');
    }
  }

  private assertWriteAccess(orgCode: string, req: RequestWithAuth): void {
    if (!req.auth || !this.policy.canManageAttendeeOps(req.auth, orgCode)) {
      throw new ForbiddenException('ORG_ADMIN or ORG_STAFF role required for attendee lifecycle actions');
    }
  }

  private async getOrg(orgCode: string): Promise<{ id: string; code: string }> {
    const org = await this.prisma.organization.findUnique({
      where: { code: orgCode },
      select: { id: true, code: true }
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  private async getRegistrant(orgId: string, registrantId: string) {
    const registrant = await this.prisma.registrant.findFirst({
      where: {
        id: registrantId,
        organizationId: orgId
      }
    });

    if (!registrant) {
      throw new NotFoundException('Attendee not found');
    }

    return registrant;
  }

  async listAttendees(input: { orgCode: string; dto: ListAttendeesDto; req: RequestWithAuth }) {
    this.assertReadAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);

    const page = Math.max(1, Number(input.dto.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(input.dto.pageSize || 20)));
    const skip = (page - 1) * pageSize;

    const where = {
      organizationId: org.id,
      eventId: input.dto.eventId,
      lifecycleStatus: input.dto.status as AttendeeLifecycleStatus | undefined,
      OR:
        input.dto.search && input.dto.search.trim().length > 0
          ? [
              { fullName: { contains: input.dto.search.trim() } },
              { email: { contains: input.dto.search.trim() } },
              { referenceCode: { contains: input.dto.search.trim() } }
            ]
          : undefined
    };

    const [total, attendees] = await Promise.all([
      this.prisma.registrant.count({ where }),
      this.prisma.registrant.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: pageSize,
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
              slug: true,
              title: true
            }
          },
          badges: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 1,
            select: {
              id: true,
              status: true,
              deliveredAt: true,
              createdAt: true
            }
          },
          responses: {
            select: {
              fieldKey: true,
              valueText: true
            }
          },
          checkins: {
            orderBy: {
              scannedAt: 'desc'
            },
            take: 1,
            select: {
              scannedAt: true
            }
          }
        }
      })
    ]);

    return {
      items: attendees.map(item => ({
        id: item.id,
        referenceCode: item.referenceCode,
        fullName: item.fullName,
        email: item.email,
        lifecycleStatus: item.lifecycleStatus,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        event: item.event,
        registrationLink: item.registrationLink,
        latestBadge: item.badges[0] || null,
        responses: item.responses,
        hasCheckedIn: item.checkins.length > 0,
        lastCheckinAt: item.checkins[0]?.scannedAt || null
      })),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async listAttendeeCommunications(input: {
    orgCode: string;
    registrantId: string;
    dto: ListAttendeeCommunicationsDto;
    req: RequestWithAuth;
  }) {
    this.assertReadAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);
    const registrant = await this.getRegistrant(org.id, input.registrantId);

    const page = Math.max(1, Number(input.dto.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(input.dto.pageSize || 20)));
    const skip = (page - 1) * pageSize;

    const where = {
      organizationId: org.id,
      registrantId: registrant.id,
      channel: input.dto.channel,
      status: input.dto.status
    };

    const [total, logs] = await Promise.all([
      this.prisma.communicationLog.count({ where }),
      this.prisma.communicationLog.findMany({
        where,
        include: {
          template: {
            select: {
              id: true,
              name: true,
              channel: true
            }
          },
          senderUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: pageSize
      })
    ]);

    return {
      attendee: {
        id: registrant.id,
        referenceCode: registrant.referenceCode,
        fullName: registrant.fullName,
        email: registrant.email
      },
      items: logs.map(log => ({
        id: log.id,
        channel: log.channel,
        status: log.status,
        recipientAddress: log.recipientAddress,
        providerMessageId: log.providerMessageId,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt,
        sentAt: log.sentAt,
        template: log.template,
        sender: log.senderUser
      })),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async updateAttendee(input: {
    orgCode: string;
    registrantId: string;
    dto: UpdateAttendeeDto;
    req: RequestWithAuth;
  }) {
    this.assertWriteAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);
    const registrant = await this.getRegistrant(org.id, input.registrantId);

    try {
      // Track if we need to regenerate badge due to data changes
      const nameChanged = input.dto.fullName && input.dto.fullName !== registrant.fullName;
      const emailChanged = input.dto.email && this.normalizeEmail(input.dto.email) !== registrant.email;
      const dataChanged = nameChanged || emailChanged || (input.dto.responses && input.dto.responses.length > 0);

      const updated = await this.prisma.registrant.update({
        where: {
          id: registrant.id
        },
        data: {
          fullName: input.dto.fullName,
          email: input.dto.email ? this.normalizeEmail(input.dto.email) : undefined
        }
      });

      // Update response fields if provided
      if (input.dto.responses && input.dto.responses.length > 0) {
        for (const response of input.dto.responses) {
          await this.prisma.registrantResponse.upsert({
            where: {
              registrantId_fieldKey: {
                registrantId: registrant.id,
                fieldKey: response.fieldKey
              }
            },
            create: {
              registrantId: registrant.id,
              fieldKey: response.fieldKey,
              valueText: response.value
            },
            update: {
              valueText: response.value
            }
          });
        }
      }

      await this.audit.write({
        actorUserId: input.req.auth?.userId || null,
        organizationId: org.id,
        action: 'ATTENDEE_EDIT',
        targetType: 'REGISTRANT',
        targetId: updated.id,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: this.getIp(input.req)
      });

      // Regenerate badge if registrant data changed and they are approved
      if (dataChanged && registrant.lifecycleStatus === AttendeeLifecycleStatus.APPROVED) {
        try {
          await this.badgeQrService.regenerateBadge({
            orgCode: org.code,
            registrantId: registrant.id
          });
        } catch {
          // Log but don't fail the update if badge regeneration fails
        }
      }

      return updated;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Email already exists for this registration link');
      }

      throw error;
    }
  }

  async approveAttendee(input: { orgCode: string; registrantId: string; req: RequestWithAuth }) {
    return this.updateLifecycleStatus({
      ...input,
      status: 'APPROVED',
      action: 'ATTENDEE_APPROVE'
    });
  }

  async rejectAttendee(input: { orgCode: string; registrantId: string; req: RequestWithAuth }) {
    return this.updateLifecycleStatus({
      ...input,
      status: 'REJECTED',
      action: 'ATTENDEE_REJECT'
    });
  }

  private async updateLifecycleStatus(input: {
    orgCode: string;
    registrantId: string;
    req: RequestWithAuth;
    status: AttendeeLifecycleStatus;
    action: string;
  }) {
    this.assertWriteAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);
    const registrant = await this.getRegistrant(org.id, input.registrantId);
    const transitionedToApproved =
      registrant.lifecycleStatus !== AttendeeLifecycleStatus.APPROVED && input.status === AttendeeLifecycleStatus.APPROVED;

    const updated = await this.prisma.registrant.update({
      where: { id: registrant.id },
      data: {
        lifecycleStatus: input.status,
        lifecycleUpdatedAt: new Date()
      }
    });

    await this.audit.write({
      actorUserId: input.req.auth?.userId || null,
      organizationId: org.id,
      action: input.action,
      targetType: 'REGISTRANT',
      targetId: updated.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getIp(input.req)
    });

    let badgeQueued = false;
    if (transitionedToApproved) {
      try {
        await this.badgeQrService.issueForRegistrant({ registrantId: registrant.id });
        badgeQueued = true;
      } catch {
        // Do not block lifecycle transitions if badge queueing fails.
      }
    }

    if (updated.lifecycleStatus === AttendeeLifecycleStatus.APPROVED) {
      await this.communicationsService.queueAutomatedMessage({
        organizationId: org.id,
        registrantId: registrant.id,
        recipientAddress: registrant.email,
        messageType: 'APPROVAL_CONFIRMATION',
        metadata: {
          source: 'attendee.lifecycle.approve',
          approvedByUserId: input.req.auth?.userId || null
        }
      });
    }

    if (updated.lifecycleStatus === AttendeeLifecycleStatus.REJECTED) {
      await this.communicationsService.queueAutomatedMessage({
        organizationId: org.id,
        registrantId: registrant.id,
        recipientAddress: registrant.email,
        messageType: 'REJECTION_MESSAGE',
        metadata: {
          source: 'attendee.lifecycle.reject',
          rejectedByUserId: input.req.auth?.userId || null
        }
      });
    }

    return {
      id: updated.id,
      lifecycleStatus: updated.lifecycleStatus,
      lifecycleUpdatedAt: updated.lifecycleUpdatedAt,
      badgeQueued
    };
  }

  async resendBadge(input: { orgCode: string; registrantId: string; req: RequestWithAuth }) {
    this.assertWriteAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);
    const registrant = await this.getRegistrant(org.id, input.registrantId);

    if (registrant.lifecycleStatus === 'REJECTED') {
      throw new BadRequestException('Cannot resend badge for rejected attendee');
    }

    const latestBadge = await this.prisma.badge.findFirst({
      where: {
        registrantId: registrant.id,
        organizationId: org.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    let badgeId: string;
    if (!latestBadge) {
      const issued = await this.badgeQrService.issueForRegistrant({ registrantId: registrant.id });
      badgeId = issued.badgeId;
    } else {
      const updatedBadge = await this.prisma.badge.update({
        where: { id: latestBadge.id },
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
        { badgeId: updatedBadge.id },
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

      badgeId = updatedBadge.id;
    }

    await this.audit.write({
      actorUserId: input.req.auth?.userId || null,
      organizationId: org.id,
      action: 'ATTENDEE_RESEND_BADGE',
      targetType: 'REGISTRANT',
      targetId: registrant.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getIp(input.req),
      metadataJson: {
        badgeId
      }
    });

    return {
      registrantId: registrant.id,
      badgeId,
      status: 'QUEUED'
    };
  }

  async manualCheckIn(input: { orgCode: string; registrantId: string; req: RequestWithAuth }) {
    this.assertWriteAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);
    const registrant = await this.getRegistrant(org.id, input.registrantId);

    if (registrant.lifecycleStatus !== AttendeeLifecycleStatus.APPROVED) {
      throw new BadRequestException('Only approved attendees can be checked in');
    }

    // Check if already checked in
    const existingCheckIn = await this.prisma.checkin.findUnique({
      where: {
        eventId_registrantId: {
          eventId: registrant.eventId,
          registrantId: registrant.id
        }
      }
    });

    if (existingCheckIn) {
      throw new BadRequestException('Attendee is already checked in');
    }

    // Create manual check-in record
    const checkin = await this.prisma.checkin.create({
      data: {
        organizationId: org.id,
        eventId: registrant.eventId,
        registrantId: registrant.id,
        usherUserId: input.req.auth?.userId || null,
        deviceId: 'manual-organizer',
        idempotencyKey: `manual-${registrant.id}-${Date.now()}`,
        source: 'MANUAL',
        scannedAt: new Date(),
        syncState: 'ACCEPTED'
      }
    });

    await this.audit.write({
      actorUserId: input.req.auth?.userId || null,
      organizationId: org.id,
      action: 'ATTENDEE_MANUAL_CHECKIN',
      targetType: 'REGISTRANT',
      targetId: registrant.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getIp(input.req),
      metadataJson: {
        checkinId: checkin.id
      }
    });

    return {
      registrantId: registrant.id,
      checkinId: checkin.id,
      checkedInAt: checkin.scannedAt
    };
  }

  async cancelRegistration(input: { orgCode: string; registrantId: string; req: RequestWithAuth }) {
    this.assertWriteAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);
    const registrant = await this.getRegistrant(org.id, input.registrantId);

    // Cannot cancel if already checked in
    const checkin = await this.prisma.checkin.findUnique({
      where: {
        eventId_registrantId: {
          eventId: registrant.eventId,
          registrantId: registrant.id
        }
      }
    });

    if (checkin) {
      throw new BadRequestException('Cannot cancel registration for already checked-in attendee');
    }

    const updated = await this.prisma.registrant.update({
      where: { id: registrant.id },
      data: {
        lifecycleStatus: AttendeeLifecycleStatus.REJECTED,
        lifecycleUpdatedAt: new Date()
      }
    });

    await this.audit.write({
      actorUserId: input.req.auth?.userId || null,
      organizationId: org.id,
      action: 'ATTENDEE_CANCEL',
      targetType: 'REGISTRANT',
      targetId: registrant.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getIp(input.req)
    });

    await this.communicationsService.queueAutomatedMessage({
      organizationId: org.id,
      registrantId: registrant.id,
      recipientAddress: registrant.email,
      messageType: 'REJECTION_MESSAGE',
      metadata: {
        source: 'attendee.lifecycle.cancel',
        cancelledByUserId: input.req.auth?.userId || null
      }
    });

    return {
      registrantId: registrant.id,
      lifecycleStatus: updated.lifecycleStatus,
      lifecycleUpdatedAt: updated.lifecycleUpdatedAt
    };
  }

  async registerOnsite(input: {
    orgCode: string;
    registrationLinkSlug: string;
    dto: OnsiteRegistrationDto;
    req: RequestWithAuth;
  }) {
    this.assertWriteAccess(input.orgCode, input.req);
    const org = await this.getOrg(input.orgCode);

    // Get registration link and event
    const link = await this.prisma.registrationLink.findFirst({
      where: {
        slug: input.registrationLinkSlug,
        organizationId: org.id
      },
      include: {
        event: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!link) {
      throw new NotFoundException('Registration link not found');
    }

    const normalizedEmail = this.normalizeEmail(input.dto.email);

    // Check for duplicate email in the same event
    const existingRegistrant = await this.prisma.registrant.findFirst({
      where: {
        eventId: link.eventId,
        email: normalizedEmail
      }
    });

    if (existingRegistrant) {
      throw new ConflictException(`Email already registered for this event (Reference: ${existingRegistrant.referenceCode})`);
    }

    // Check for duplicate email in the same registration link
    const existingInLink = await this.prisma.registrant.findFirst({
      where: {
        registrationLinkId: link.id,
        email: normalizedEmail
      }
    });

    if (existingInLink) {
      throw new ConflictException('Email already registered for this category');
    }

    // Generate reference code (format: EVENT-LINK-TIMESTAMP-RANDOM)
    const eventCode = link.event.name.substring(0, 3).toUpperCase();
    const linkCode = input.registrationLinkSlug.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const referenceCode = `${eventCode}${linkCode}${timestamp}${random}`;

    // Create registrant with auto-approval
    const registrant = await this.prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: link.eventId,
        registrationLinkId: link.id,
        referenceCode,
        email: normalizedEmail,
        fullName: input.dto.fullName,
        lifecycleStatus: AttendeeLifecycleStatus.APPROVED,
        lifecycleUpdatedAt: new Date(),
        consentAccepted: true,
        consentPolicyVersion: 'onsite-v1',
        consentCapturedAt: new Date()
      }
    });

    // Store response fields if provided
    if (input.dto.responses && input.dto.responses.length > 0) {
      const responseData = input.dto.responses.map(r => ({
        registrantId: registrant.id,
        fieldKey: r.fieldKey,
        valueText: r.value
      }));

      await this.prisma.registrantResponse.createMany({
        data: responseData
      });
    }

    // Store photo if provided
    if (input.dto.photoUrl) {
      await this.prisma.registrantResponse.upsert({
        where: {
          registrantId_fieldKey: {
            registrantId: registrant.id,
            fieldKey: '__photo_upload__'
          }
        },
        create: {
          registrantId: registrant.id,
          fieldKey: '__photo_upload__',
          valueText: input.dto.photoUrl
        },
        update: {
          valueText: input.dto.photoUrl
        }
      });
    }

    // Trigger badge generation
    let badgeQueued = false;
    try {
      await this.badgeQrService.issueForRegistrant({ registrantId: registrant.id });
      badgeQueued = true;
    } catch {
      // Log but don't fail registration if badge queuing fails
    }

    // Audit log
    await this.audit.write({
      actorUserId: input.req.auth?.userId || null,
      organizationId: org.id,
      action: 'ONSITE_REGISTRATION',
      targetType: 'REGISTRANT',
      targetId: registrant.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getIp(input.req),
      metadataJson: {
        registrationLink: link.slug
      }
    });

    // Return created registrant with badge info
    const latestBadge = await this.prisma.badge.findFirst({
      where: {
        registrantId: registrant.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        status: true
      }
    });

    return {
      registrantId: registrant.id,
      referenceCode: registrant.referenceCode,
      fullName: registrant.fullName,
      email: registrant.email,
      eventName: link.event.name,
      categoryName: link.title,
      lifecycleStatus: registrant.lifecycleStatus,
      badgeId: latestBadge?.id || null,
      badgeStatus: latestBadge?.status || 'PENDING',
      badgeQueued,
      createdAt: registrant.createdAt
    };
  }
}
