import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AuditOutcome, EventStatus, LinkApprovalMode, LinkVisibility } from '@prisma/client';
import { PrismaService } from '../../infra/db/prisma.service';
import { AuditService } from '../common/audit.service';
import { PolicyService } from '../common/policy.service';
import type { RequestWithAuth } from '../common/request-with-auth';
import type { CreateEventDto } from './dto/create-event.dto';
import type { UpdateEventDto } from './dto/update-event.dto';
import type { CreateLinkDto } from './dto/create-link.dto';
import type { UpdateLinkDto } from './dto/update-link.dto';

@Injectable()
export class EventsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PolicyService) private readonly policy: PolicyService
  ) {}

  private getClientIp(req: RequestWithAuth): string | null {
    return req.ip || null;
  }

  private assertEventWritePermission(orgCode: string, req: RequestWithAuth): void {
    if (!req.auth) {
      throw new ForbiddenException('Authenticated user required');
    }

    if (!this.policy.canManageEventSettings(req.auth, orgCode)) {
      throw new ForbiddenException('ORG_ADMIN role required to modify event settings');
    }
  }

  private validateEventWindow(startsAt?: string, endsAt?: string): void {
    if (!startsAt || !endsAt) {
      return;
    }

    if (new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
      throw new BadRequestException('Event startsAt cannot be after endsAt');
    }
  }

  private validateLinkWindow(opensAt?: string, closesAt?: string): void {
    if (!opensAt || !closesAt) {
      return;
    }

    if (new Date(opensAt).getTime() > new Date(closesAt).getTime()) {
      throw new BadRequestException('Link opensAt cannot be after closesAt');
    }
  }

  private async getOrganizationByCode(orgCode: string): Promise<{ id: string; code: string }> {
    const org = await this.prisma.organization.findUnique({
      where: { code: orgCode },
      select: { id: true, code: true }
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async createEvent(orgCode: string, dto: CreateEventDto, req: RequestWithAuth) {
    this.assertEventWritePermission(orgCode, req);
    this.validateEventWindow(dto.startsAt, dto.endsAt);

    const org = await this.getOrganizationByCode(orgCode);

    const created = await this.prisma.event.create({
      data: {
        organizationId: org.id,
        name: dto.name,
        description: dto.description,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        status: 'DRAFT'
      }
    });

    await this.audit.write({
      actorUserId: req.auth?.userId || null,
      organizationId: org.id,
      action: 'EVENT_CREATE',
      targetType: 'EVENT',
      targetId: created.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req)
    });

    return created;
  }

  async listEvents(orgCode: string, req: RequestWithAuth) {
    if (!req.auth || !this.policy.canAccessTenant(req.auth, orgCode)) {
      throw new ForbiddenException('Missing tenant access');
    }

    const org = await this.getOrganizationByCode(orgCode);

    return this.prisma.event.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateEvent(orgCode: string, eventId: string, dto: UpdateEventDto, req: RequestWithAuth) {
    this.assertEventWritePermission(orgCode, req);

    const org = await this.getOrganizationByCode(orgCode);
    const existing = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId: org.id
      }
    });

    if (!existing) {
      throw new NotFoundException('Event not found');
    }

    const nextStartsAt = dto.startsAt ?? existing.startsAt?.toISOString();
    const nextEndsAt = dto.endsAt ?? existing.endsAt?.toISOString();
    this.validateEventWindow(nextStartsAt, nextEndsAt);

    const updated = await this.prisma.event.update({
      where: { id: existing.id },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status as EventStatus | undefined,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : dto.startsAt === undefined ? undefined : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : dto.endsAt === undefined ? undefined : null
      }
    });

    await this.audit.write({
      actorUserId: req.auth?.userId || null,
      organizationId: org.id,
      action: 'EVENT_UPDATE',
      targetType: 'EVENT',
      targetId: updated.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req)
    });

    return updated;
  }

  async archiveEvent(orgCode: string, eventId: string, req: RequestWithAuth) {
    this.assertEventWritePermission(orgCode, req);

    const org = await this.getOrganizationByCode(orgCode);
    const existing = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId: org.id
      }
    });

    if (!existing) {
      throw new NotFoundException('Event not found');
    }

    const archived = await this.prisma.event.update({
      where: { id: existing.id },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date()
      }
    });

    await this.audit.write({
      actorUserId: req.auth?.userId || null,
      organizationId: org.id,
      action: 'EVENT_ARCHIVE',
      targetType: 'EVENT',
      targetId: archived.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req)
    });

    return archived;
  }

  async createLink(orgCode: string, eventId: string, dto: CreateLinkDto, req: RequestWithAuth) {
    this.assertEventWritePermission(orgCode, req);
    this.validateLinkWindow(dto.opensAt, dto.closesAt);

    const org = await this.getOrganizationByCode(orgCode);
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId: org.id
      }
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    try {
      const created = await this.prisma.registrationLink.create({
        data: {
          organizationId: org.id,
          eventId: event.id,
          slug: dto.slug,
          title: dto.title,
          rule: {
            create: {
              visibility: dto.visibility || 'PUBLIC',
              capacity: dto.capacity,
              approvalMode: dto.approvalMode || 'AUTO',
              opensAt: dto.opensAt ? new Date(dto.opensAt) : null,
              closesAt: dto.closesAt ? new Date(dto.closesAt) : null
            }
          }
        },
        include: {
          rule: true
        }
      });

      await this.audit.write({
        actorUserId: req.auth?.userId || null,
        organizationId: org.id,
        action: 'LINK_CREATE',
        targetType: 'REGISTRATION_LINK',
        targetId: created.id,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: this.getClientIp(req)
      });

      return created;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint failed')) {
        throw new BadRequestException('Link slug must be unique for the event');
      }
      throw error;
    }
  }

  async listLinks(orgCode: string, eventId: string, req: RequestWithAuth) {
    if (!req.auth || !this.policy.canAccessTenant(req.auth, orgCode)) {
      throw new ForbiddenException('Missing tenant access');
    }

    const org = await this.getOrganizationByCode(orgCode);
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId: org.id
      }
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return this.prisma.registrationLink.findMany({
      where: {
        eventId: event.id,
        organizationId: org.id
      },
      include: {
        rule: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateLink(
    orgCode: string,
    eventId: string,
    linkId: string,
    dto: UpdateLinkDto,
    req: RequestWithAuth
  ) {
    this.assertEventWritePermission(orgCode, req);
    this.validateLinkWindow(dto.opensAt, dto.closesAt);

    const org = await this.getOrganizationByCode(orgCode);

    const link = await this.prisma.registrationLink.findFirst({
      where: {
        id: linkId,
        eventId,
        organizationId: org.id
      },
      include: {
        rule: true
      }
    });

    if (!link) {
      throw new NotFoundException('Registration link not found');
    }

    try {
      const updated = await this.prisma.registrationLink.update({
        where: { id: link.id },
        data: {
          title: dto.title,
          slug: dto.slug,
          isActive: dto.isActive,
          rule: {
            upsert: {
              create: {
                visibility: (dto.visibility || 'PUBLIC') as LinkVisibility,
                capacity: dto.capacity,
                approvalMode: (dto.approvalMode || 'AUTO') as LinkApprovalMode,
                opensAt: dto.opensAt ? new Date(dto.opensAt) : null,
                closesAt: dto.closesAt ? new Date(dto.closesAt) : null
              },
              update: {
                visibility: dto.visibility,
                capacity: dto.capacity,
                approvalMode: dto.approvalMode,
                opensAt: dto.opensAt ? new Date(dto.opensAt) : dto.opensAt === undefined ? undefined : null,
                closesAt: dto.closesAt ? new Date(dto.closesAt) : dto.closesAt === undefined ? undefined : null
              }
            }
          }
        },
        include: {
          rule: true
        }
      });

      await this.audit.write({
        actorUserId: req.auth?.userId || null,
        organizationId: org.id,
        action: 'LINK_UPDATE',
        targetType: 'REGISTRATION_LINK',
        targetId: updated.id,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: this.getClientIp(req)
      });

      return updated;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint failed')) {
        throw new BadRequestException('Link slug must be unique for the event');
      }
      throw error;
    }
  }

  async getPublicLinkMetadata(orgCode: string, eventId: string, slug: string) {
    const org = await this.getOrganizationByCode(orgCode);

    const link = await this.prisma.registrationLink.findFirst({
      where: {
        organizationId: org.id,
        eventId,
        slug,
        isActive: true,
        event: {
          status: {
            not: 'ARCHIVED'
          }
        }
      },
      include: {
        event: true,
        rule: true
      }
    });

    if (!link) {
      throw new NotFoundException('Registration link not found');
    }

    const now = Date.now();
    const opensAt = link.rule?.opensAt?.getTime();
    const closesAt = link.rule?.closesAt?.getTime();
    const isOpen = (!opensAt || opensAt <= now) && (!closesAt || closesAt >= now);

    return {
      organizationCode: org.code,
      eventId: link.eventId,
      eventName: link.event.name,
      linkId: link.id,
      slug: link.slug,
      title: link.title,
      status: link.event.status,
      effectiveRules: {
        visibility: link.rule?.visibility || 'PUBLIC',
        capacity: link.rule?.capacity ?? null,
        approvalMode: link.rule?.approvalMode || 'AUTO',
        opensAt: link.rule?.opensAt || null,
        closesAt: link.rule?.closesAt || null,
        isOpen
      }
    };
  }
}
