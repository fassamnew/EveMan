import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AuditOutcome,
  EventStatus,
  FormFieldType,
  LinkApprovalMode,
  LinkVisibility,
  Prisma
} from '@prisma/client';
import { PrismaService } from '../../infra/db/prisma.service';
import { AuditService } from '../common/audit.service';
import { PolicyService } from '../common/policy.service';
import type { RequestWithAuth } from '../common/request-with-auth';
import type { CreateEventDto } from './dto/create-event.dto';
import type { UpdateEventDto } from './dto/update-event.dto';
import type { CreateLinkDto } from './dto/create-link.dto';
import type { UpdateLinkDto } from './dto/update-link.dto';
import type { LinkFormFieldInputDto, UpdateLinkFormFieldsDto } from './dto/update-link-form-fields.dto';
import type { CreateEventTemplateDto } from './dto/create-event-template.dto';
import type { ApplyEventTemplateDto } from './dto/apply-event-template.dto';
import type { LinkApprovalRuleInputDto, UpdateLinkApprovalRulesDto } from './dto/update-link-approval-rules.dto';
import type { UpdateEventSettingsDto } from './dto/update-event-settings.dto';
import type { UpdateLinkSettingsDto } from './dto/update-link-settings.dto';

const LINK_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type EventTemplateRecord = {
  id: string;
  name: string;
  eventDraft: {
    name: string;
  };
  createdAt: string;
  updatedAt: string;
};

type LinkApprovalRuleRecord = {
  id: string;
  fieldKey: string;
  operator: 'EQ' | 'NEQ' | 'CONTAINS' | 'NOT_CONTAINS' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IS_TRUE' | 'IS_FALSE';
  value?: string;
  action: 'APPROVE' | 'PENDING' | 'REJECT';
  name?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

type EventSettingsRecord = {
  venue: string | null;
  eventLogoUrl: string | null;
  eventBannerUrl: string | null;
  registrationStartsAt: string | null;
  registrationEndsAt: string | null;
  checkinPolicy: 'OPEN' | 'APPROVED_ONLY' | 'ONSITE_ONLY' | null;
};

type LinkSettingsRecord = {
  confirmationMessage: string | null;
  emailTemplateName: string | null;
  registrationInstructions: string | null;
  photoUpload: 'REQUIRED' | 'OPTIONAL' | 'DISABLED' | null;
  accessMode: 'PUBLIC' | 'INVITE_ONLY' | 'PASSWORD_PROTECTED' | null;
  accessPassword: string | null;
  allowRegistrantUpdate: boolean;
  smsDeliveryEnabled: boolean;
  smsTemplateName: string | null;
  smsRecipientFieldKey: string | null;
  pageTemplate:
    | 'CONFERENCE'
    | 'EXHIBITION'
    | 'VIP_INVITATION'
    | 'MEDIA_ACCREDITATION'
    | 'SPEAKER_REGISTRATION'
    | 'WORKSHOP_TRAINING'
    | null;
  pageLogoUrl: string | null;
  pageBannerImageUrl: string | null;
  pageBackgroundColor: string | null;
  pageButtonColor: string | null;
  pageFontFamily: string | null;
  pageEventDescription: string | null;
  sponsorLogoUrls: string[];
  formLayout: 'SINGLE_COLUMN' | 'TWO_COLUMN' | null;
  footerText: string | null;
  privacyNotice: string | null;
  termsAndConditions: string | null;
};

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

  private validateLinkCapacity(capacity?: number | null): void {
    if (capacity === undefined || capacity === null) {
      return;
    }

    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new BadRequestException('Link capacity must be an integer greater than 0');
    }
  }

  private parseMetadataStringArray(value: string | undefined): string[] {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'code' in error) {
      return (error as { code?: string }).code === 'P2002';
    }

    return error instanceof Error && error.message.includes('Unique constraint failed');
  }

  private normalizeSlugBase(slug: string): string {
    const normalized = slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');

    return normalized || 'link';
  }

  private async buildSlugSuggestions(
    organizationId: string,
    eventId: string,
    attemptedSlug: string
  ): Promise<string[]> {
    const base = this.normalizeSlugBase(attemptedSlug);
    const existing = await this.prisma.registrationLink.findMany({
      where: {
        organizationId,
        eventId,
        slug: {
          startsWith: base
        }
      },
      select: {
        slug: true
      }
    });

    const taken = new Set(existing.map(item => item.slug));
    const suggestions: string[] = [];

    if (!taken.has(base)) {
      suggestions.push(base);
    }

    let suffix = 1;
    while (suggestions.length < 3) {
      const candidate = `${base}-${suffix}`;
      if (!taken.has(candidate)) {
        suggestions.push(candidate);
      }
      suffix += 1;
    }

    return suggestions;
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

  private eventTemplatePrefix(orgId: string): string {
    return `org:${orgId}:event-template:`;
  }

  private async getEventTemplates(orgId: string): Promise<EventTemplateRecord[]> {
    const rows = await this.prisma.migrationMetadata.findMany({
      where: {
        key: {
          startsWith: this.eventTemplatePrefix(orgId)
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return rows
      .map(row => {
        try {
          const parsed = JSON.parse(row.value) as { name?: string; eventName?: string };
          if (!parsed.name || !parsed.eventName) {
            return null;
          }

          return {
            id: row.key.replace(this.eventTemplatePrefix(orgId), ''),
            name: parsed.name,
            eventDraft: {
              name: parsed.eventName
            },
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString()
          } satisfies EventTemplateRecord;
        } catch {
          return null;
        }
      })
      .filter((template): template is EventTemplateRecord => template !== null);
  }

  private async saveEventTemplate(orgId: string, templateId: string, value: { name: string; eventName: string }): Promise<void> {
    await this.prisma.migrationMetadata.upsert({
      where: {
        key: `${this.eventTemplatePrefix(orgId)}${templateId}`
      },
      update: {
        value: JSON.stringify(value)
      },
      create: {
        key: `${this.eventTemplatePrefix(orgId)}${templateId}`,
        value: JSON.stringify(value)
      }
    });
  }

  private linkApprovalRulePrefix(linkId: string): string {
    return `link:${linkId}:approval-rule:`;
  }

  private async getLinkApprovalRules(linkId: string): Promise<LinkApprovalRuleRecord[]> {
    const rows = await this.prisma.migrationMetadata.findMany({
      where: {
        key: {
          startsWith: this.linkApprovalRulePrefix(linkId)
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    const parsedRules: LinkApprovalRuleRecord[] = [];
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.value) as {
          fieldKey?: string;
          operator?: LinkApprovalRuleRecord['operator'];
          value?: string;
          action?: LinkApprovalRuleRecord['action'];
          name?: string;
          order?: number;
        };

        if (!parsed.fieldKey || !parsed.operator || !parsed.action) {
          continue;
        }

        parsedRules.push({
          id: row.key.replace(this.linkApprovalRulePrefix(linkId), ''),
          fieldKey: parsed.fieldKey,
          operator: parsed.operator,
          value: parsed.value,
          action: parsed.action,
          name: parsed.name,
          order: parsed.order ?? 0,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString()
        });
      } catch {
        // Ignore malformed rule entries.
      }
    }

    return parsedRules.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
  }

  private validateLinkApprovalRules(rules: LinkApprovalRuleInputDto[]): void {
    rules.forEach((rule, index) => {
      if ((rule.operator === 'IS_TRUE' || rule.operator === 'IS_FALSE') && rule.value) {
        throw new BadRequestException(`Rule ${index + 1}: value must be empty for ${rule.operator}`);
      }

      if (rule.operator !== 'IS_TRUE' && rule.operator !== 'IS_FALSE' && !rule.value?.trim()) {
        throw new BadRequestException(`Rule ${index + 1}: value is required for ${rule.operator}`);
      }
    });
  }

  private eventSettingsPrefix(eventId: string): string {
    return `event:${eventId}:settings:`;
  }

  private linkSettingsPrefix(linkId: string): string {
    return `link:${linkId}:settings:`;
  }

  private validateRegistrationWindow(startsAt?: string, endsAt?: string): void {
    if (!startsAt || !endsAt) {
      return;
    }

    if (new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
      throw new BadRequestException('Registration startsAt cannot be after registration endsAt');
    }
  }

  private async getEventSettingsByEventId(eventId: string): Promise<EventSettingsRecord> {
    const rows = await this.prisma.migrationMetadata.findMany({
      where: {
        key: {
          startsWith: this.eventSettingsPrefix(eventId)
        }
      }
    });

    const valueByKey = new Map(rows.map(row => [row.key.replace(this.eventSettingsPrefix(eventId), ''), row.value]));

    const checkinPolicyRaw = valueByKey.get('checkinPolicy');
    const checkinPolicy =
      checkinPolicyRaw === 'OPEN' || checkinPolicyRaw === 'APPROVED_ONLY' || checkinPolicyRaw === 'ONSITE_ONLY'
        ? checkinPolicyRaw
        : null;

    return {
      venue: valueByKey.get('venue') || null,
      eventLogoUrl: valueByKey.get('eventLogoUrl') || null,
      eventBannerUrl: valueByKey.get('eventBannerUrl') || null,
      registrationStartsAt: valueByKey.get('registrationStartsAt') || null,
      registrationEndsAt: valueByKey.get('registrationEndsAt') || null,
      checkinPolicy
    };
  }

  private async upsertMetadataValue(key: string, value?: string | null): Promise<void> {
    const normalized = value?.trim();
    const existing = await this.prisma.migrationMetadata.findUnique({
      where: { key },
      select: { key: true }
    });

    if (!normalized) {
      if (existing) {
        await this.prisma.migrationMetadata.delete({ where: { key } });
      }
      return;
    }

    if (existing) {
      await this.prisma.migrationMetadata.update({
        where: { key },
        data: { value: normalized }
      });
      return;
    }

    await this.prisma.migrationMetadata.create({
      data: {
        key,
        value: normalized
      }
    });
  }

  private async getLinkSettingsByLinkId(linkId: string): Promise<LinkSettingsRecord> {
    const rows = await this.prisma.migrationMetadata.findMany({
      where: {
        key: {
          startsWith: this.linkSettingsPrefix(linkId)
        }
      }
    });

    const valueByKey = new Map(rows.map(row => [row.key.replace(this.linkSettingsPrefix(linkId), ''), row.value]));
    const photoUploadRaw = valueByKey.get('photoUpload');
    const accessModeRaw = valueByKey.get('accessMode');
    const allowRegistrantUpdateRaw = valueByKey.get('allowRegistrantUpdate');
    const smsDeliveryEnabledRaw = valueByKey.get('smsDeliveryEnabled');
    const pageTemplateRaw = valueByKey.get('pageTemplate');
    const formLayoutRaw = valueByKey.get('formLayout');

    const photoUpload =
      photoUploadRaw === 'REQUIRED' || photoUploadRaw === 'OPTIONAL' || photoUploadRaw === 'DISABLED'
        ? photoUploadRaw
        : null;

    const accessMode =
      accessModeRaw === 'PUBLIC' || accessModeRaw === 'INVITE_ONLY' || accessModeRaw === 'PASSWORD_PROTECTED'
        ? accessModeRaw
        : null;

    const pageTemplate =
      pageTemplateRaw === 'CONFERENCE' ||
      pageTemplateRaw === 'EXHIBITION' ||
      pageTemplateRaw === 'VIP_INVITATION' ||
      pageTemplateRaw === 'MEDIA_ACCREDITATION' ||
      pageTemplateRaw === 'SPEAKER_REGISTRATION' ||
      pageTemplateRaw === 'WORKSHOP_TRAINING'
        ? pageTemplateRaw
        : null;

    const formLayout = formLayoutRaw === 'SINGLE_COLUMN' || formLayoutRaw === 'TWO_COLUMN' ? formLayoutRaw : null;

    return {
      confirmationMessage: valueByKey.get('confirmationMessage') || null,
      emailTemplateName: valueByKey.get('emailTemplateName') || null,
      registrationInstructions: valueByKey.get('registrationInstructions') || null,
      photoUpload,
      accessMode,
      accessPassword: valueByKey.get('accessPassword') || null,
      allowRegistrantUpdate: allowRegistrantUpdateRaw === '1',
      smsDeliveryEnabled: smsDeliveryEnabledRaw === '1',
      smsTemplateName: valueByKey.get('smsTemplateName') || null,
      smsRecipientFieldKey: valueByKey.get('smsRecipientFieldKey') || null,
      pageTemplate,
      pageLogoUrl: valueByKey.get('pageLogoUrl') || null,
      pageBannerImageUrl: valueByKey.get('pageBannerImageUrl') || null,
      pageBackgroundColor: valueByKey.get('pageBackgroundColor') || null,
      pageButtonColor: valueByKey.get('pageButtonColor') || null,
      pageFontFamily: valueByKey.get('pageFontFamily') || null,
      pageEventDescription: valueByKey.get('pageEventDescription') || null,
      sponsorLogoUrls: this.parseMetadataStringArray(valueByKey.get('sponsorLogoUrls')),
      formLayout,
      footerText: valueByKey.get('footerText') || null,
      privacyNotice: valueByKey.get('privacyNotice') || null,
      termsAndConditions: valueByKey.get('termsAndConditions') || null
    };
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

  async listEventTemplates(orgCode: string, req: RequestWithAuth) {
    if (!req.auth || !this.policy.canAccessTenant(req.auth, orgCode)) {
      throw new ForbiddenException('Missing tenant access');
    }

    const org = await this.getOrganizationByCode(orgCode);
    return this.getEventTemplates(org.id);
  }

  async createEventTemplate(orgCode: string, dto: CreateEventTemplateDto, req: RequestWithAuth) {
    this.assertEventWritePermission(orgCode, req);

    const org = await this.getOrganizationByCode(orgCode);
    const templateId = randomUUID();
    await this.saveEventTemplate(org.id, templateId, {
      name: dto.name.trim(),
      eventName: dto.eventName.trim()
    });

    const createdRows = await this.getEventTemplates(org.id);
    const created = createdRows.find(template => template.id === templateId);
    if (!created) {
      throw new NotFoundException('Event template not found after creation');
    }

    const next: EventTemplateRecord = {
      id: created.id,
      name: created.name,
      eventDraft: created.eventDraft,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt
    };

    await this.audit.write({
      actorUserId: req.auth?.userId || null,
      organizationId: org.id,
      action: 'EVENT_TEMPLATE_CREATE',
      targetType: 'EVENT_TEMPLATE',
      targetId: next.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req)
    });

    return next;
  }

  async deleteEventTemplate(orgCode: string, templateId: string, req: RequestWithAuth) {
    this.assertEventWritePermission(orgCode, req);
    const org = await this.getOrganizationByCode(orgCode);
    const templateKey = `${this.eventTemplatePrefix(org.id)}${templateId}`;
    const existing = await this.prisma.migrationMetadata.findUnique({
      where: { key: templateKey }
    });
    const exists = Boolean(existing);
    if (!exists) {
      throw new NotFoundException('Event template not found');
    }

    await this.prisma.migrationMetadata.delete({
      where: { key: templateKey }
    });

    await this.audit.write({
      actorUserId: req.auth?.userId || null,
      organizationId: org.id,
      action: 'EVENT_TEMPLATE_DELETE',
      targetType: 'EVENT_TEMPLATE',
      targetId: templateId,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req)
    });

    return { id: templateId, deleted: true };
  }

  async applyEventTemplate(orgCode: string, templateId: string, dto: ApplyEventTemplateDto, req: RequestWithAuth) {
    this.assertEventWritePermission(orgCode, req);
    const org = await this.getOrganizationByCode(orgCode);
    const templates = await this.getEventTemplates(org.id);
    const template = templates.find(item => item.id === templateId);
    if (!template) {
      throw new NotFoundException('Event template not found');
    }

    const event = await this.createEvent(
      orgCode,
      {
        name: dto.name?.trim() || template.eventDraft.name
      },
      req
    );

    await this.audit.write({
      actorUserId: req.auth?.userId || null,
      organizationId: org.id,
      action: 'EVENT_TEMPLATE_APPLY',
      targetType: 'EVENT_TEMPLATE',
      targetId: template.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req),
      metadataJson: {
        eventId: event.id
      }
    });

    return event;
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

  async getEventSettings(orgCode: string, eventId: string, req: RequestWithAuth) {
    if (!req.auth || !this.policy.canAccessTenant(req.auth, orgCode)) {
      throw new ForbiddenException('Missing tenant access');
    }

    const org = await this.getOrganizationByCode(orgCode);
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId: org.id
      },
      select: { id: true }
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return this.getEventSettingsByEventId(event.id);
  }

  async updateEventSettings(orgCode: string, eventId: string, dto: UpdateEventSettingsDto, req: RequestWithAuth) {
    this.assertEventWritePermission(orgCode, req);
    this.validateRegistrationWindow(dto.registrationStartsAt, dto.registrationEndsAt);

    const org = await this.getOrganizationByCode(orgCode);
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId: org.id
      },
      select: { id: true }
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    await this.upsertMetadataValue(`${this.eventSettingsPrefix(event.id)}venue`, dto.venue);
    await this.upsertMetadataValue(`${this.eventSettingsPrefix(event.id)}eventLogoUrl`, dto.eventLogoUrl);
    await this.upsertMetadataValue(`${this.eventSettingsPrefix(event.id)}eventBannerUrl`, dto.eventBannerUrl);
    await this.upsertMetadataValue(
      `${this.eventSettingsPrefix(event.id)}registrationStartsAt`,
      dto.registrationStartsAt || null
    );
    await this.upsertMetadataValue(
      `${this.eventSettingsPrefix(event.id)}registrationEndsAt`,
      dto.registrationEndsAt || null
    );
    await this.upsertMetadataValue(`${this.eventSettingsPrefix(event.id)}checkinPolicy`, dto.checkinPolicy || null);

    await this.audit.write({
      actorUserId: req.auth?.userId || null,
      organizationId: org.id,
      action: 'EVENT_UPDATE',
      targetType: 'EVENT',
      targetId: event.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req),
      metadataJson: {
        updatedEventSettings: true
      }
    });

    return this.getEventSettingsByEventId(event.id);
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
    this.validateLinkCapacity(dto.capacity);

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
          linkTypeId: dto.linkTypeId ?? null,
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
          rule: true,
          linkType: true
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
      if (this.isUniqueConstraintError(error)) {
        const suggestions = await this.buildSlugSuggestions(org.id, event.id, dto.slug);
        throw new BadRequestException({
          message: 'Link slug must be unique for the event',
          suggestions
        });
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
      select: {
        id: true,
        slug: true,
        title: true,
        isActive: true,
        badgeTemplateId: true,
        linkTypeId: true,
        rule: true,
        linkType: true
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
    this.validateLinkCapacity(dto.capacity);

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
          linkTypeId: dto.linkTypeId !== undefined ? dto.linkTypeId : undefined,
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
          rule: true,
          linkType: true
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
      if (this.isUniqueConstraintError(error)) {
        const suggestions = await this.buildSlugSuggestions(org.id, eventId, dto.slug || link.slug);
        throw new BadRequestException({
          message: 'Link slug must be unique for the event',
          suggestions
        });
      }
      throw error;
    }
  }

  async getLinkSettings(orgCode: string, eventId: string, linkId: string, req: RequestWithAuth) {
    if (!req.auth || !this.policy.canAccessTenant(req.auth, orgCode)) {
      throw new ForbiddenException('Missing tenant access');
    }

    const org = await this.getOrganizationByCode(orgCode);
    const link = await this.prisma.registrationLink.findFirst({
      where: {
        id: linkId,
        eventId,
        organizationId: org.id
      },
      select: { id: true }
    });

    if (!link) {
      throw new NotFoundException('Registration link not found');
    }

    return this.getLinkSettingsByLinkId(link.id);
  }

  async updateLinkSettings(
    orgCode: string,
    eventId: string,
    linkId: string,
    dto: UpdateLinkSettingsDto,
    req: RequestWithAuth
  ) {
    this.assertEventWritePermission(orgCode, req);

    if (dto.accessMode === 'PASSWORD_PROTECTED' && !dto.accessPassword?.trim()) {
      throw new BadRequestException('accessPassword is required when accessMode is PASSWORD_PROTECTED');
    }

    const org = await this.getOrganizationByCode(orgCode);
    const link = await this.prisma.registrationLink.findFirst({
      where: {
        id: linkId,
        eventId,
        organizationId: org.id
      },
      select: { id: true }
    });

    if (!link) {
      throw new NotFoundException('Registration link not found');
    }

    await this.upsertMetadataValue(
      `${this.linkSettingsPrefix(link.id)}confirmationMessage`,
      dto.confirmationMessage
    );
    await this.upsertMetadataValue(`${this.linkSettingsPrefix(link.id)}emailTemplateName`, dto.emailTemplateName);
    await this.upsertMetadataValue(
      `${this.linkSettingsPrefix(link.id)}registrationInstructions`,
      dto.registrationInstructions
    );
    await this.upsertMetadataValue(`${this.linkSettingsPrefix(link.id)}photoUpload`, dto.photoUpload || null);
    await this.upsertMetadataValue(`${this.linkSettingsPrefix(link.id)}accessMode`, dto.accessMode || null);
    await this.upsertMetadataValue(
      `${this.linkSettingsPrefix(link.id)}accessPassword`,
      dto.accessMode === 'PASSWORD_PROTECTED' ? dto.accessPassword : null
    );
    await this.upsertMetadataValue(
      `${this.linkSettingsPrefix(link.id)}allowRegistrantUpdate`,
      dto.allowRegistrantUpdate ? '1' : null
    );
    await this.upsertMetadataValue(
      `${this.linkSettingsPrefix(link.id)}smsDeliveryEnabled`,
      dto.smsDeliveryEnabled ? '1' : null
    );
    await this.upsertMetadataValue(
      `${this.linkSettingsPrefix(link.id)}smsTemplateName`,
      dto.smsTemplateName
    );
    await this.upsertMetadataValue(
      `${this.linkSettingsPrefix(link.id)}smsRecipientFieldKey`,
      dto.smsRecipientFieldKey
    );
    await this.upsertMetadataValue(`${this.linkSettingsPrefix(link.id)}pageTemplate`, dto.pageTemplate || null);
    await this.upsertMetadataValue(`${this.linkSettingsPrefix(link.id)}pageLogoUrl`, dto.pageLogoUrl);
    await this.upsertMetadataValue(`${this.linkSettingsPrefix(link.id)}pageBannerImageUrl`, dto.pageBannerImageUrl);
    await this.upsertMetadataValue(
      `${this.linkSettingsPrefix(link.id)}pageBackgroundColor`,
      dto.pageBackgroundColor
    );
    await this.upsertMetadataValue(`${this.linkSettingsPrefix(link.id)}pageButtonColor`, dto.pageButtonColor);
    await this.upsertMetadataValue(`${this.linkSettingsPrefix(link.id)}pageFontFamily`, dto.pageFontFamily);
    await this.upsertMetadataValue(
      `${this.linkSettingsPrefix(link.id)}pageEventDescription`,
      dto.pageEventDescription
    );
    await this.upsertMetadataValue(
      `${this.linkSettingsPrefix(link.id)}sponsorLogoUrls`,
      dto.sponsorLogoUrls && dto.sponsorLogoUrls.length > 0 ? JSON.stringify(dto.sponsorLogoUrls) : null
    );
    await this.upsertMetadataValue(`${this.linkSettingsPrefix(link.id)}formLayout`, dto.formLayout || null);
    await this.upsertMetadataValue(`${this.linkSettingsPrefix(link.id)}footerText`, dto.footerText);
    await this.upsertMetadataValue(`${this.linkSettingsPrefix(link.id)}privacyNotice`, dto.privacyNotice);
    await this.upsertMetadataValue(
      `${this.linkSettingsPrefix(link.id)}termsAndConditions`,
      dto.termsAndConditions
    );

    await this.audit.write({
      actorUserId: req.auth?.userId || null,
      organizationId: org.id,
      action: 'LINK_UPDATE',
      targetType: 'REGISTRATION_LINK',
      targetId: link.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req),
      metadataJson: {
        updatedLinkSettings: true
      }
    });

    return this.getLinkSettingsByLinkId(link.id);
  }

  async deleteLink(orgCode: string, eventId: string, linkId: string, req: RequestWithAuth) {
    this.assertEventWritePermission(orgCode, req);

    const org = await this.getOrganizationByCode(orgCode);
    const link = await this.prisma.registrationLink.findFirst({
      where: {
        id: linkId,
        eventId,
        organizationId: org.id
      }
    });

    if (!link) {
      throw new NotFoundException('Registration link not found');
    }

    const deleted = await this.prisma.registrationLink.delete({
      where: { id: link.id }
    });

    await this.audit.write({
      actorUserId: req.auth?.userId || null,
      organizationId: org.id,
      action: 'LINK_DELETE',
      targetType: 'REGISTRATION_LINK',
      targetId: deleted.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req)
    });

    return {
      id: deleted.id,
      deleted: true
    };
  }

  private validateLinkFormFields(fields: LinkFormFieldInputDto[]): void {
    const uniqueKeys = new Set<string>();

    fields.forEach((field, index) => {
      const key = field.key.trim();
      if (!key) {
        throw new BadRequestException(`Field ${index + 1}: key is required`);
      }

      if (uniqueKeys.has(key)) {
        throw new BadRequestException(`Duplicate field key: ${key}`);
      }
      uniqueKeys.add(key);

      if (field.minLength !== undefined && field.maxLength !== undefined && field.minLength > field.maxLength) {
        throw new BadRequestException(`Field ${key}: minLength cannot be greater than maxLength`);
      }

      if (field.minValue !== undefined && field.maxValue !== undefined && field.minValue > field.maxValue) {
        throw new BadRequestException(`Field ${key}: minValue cannot be greater than maxValue`);
      }

      if (field.minDate !== undefined && field.maxDate !== undefined && new Date(field.minDate) > new Date(field.maxDate)) {
        throw new BadRequestException(`Field ${key}: minDate cannot be after maxDate`);
      }

      if (field.type === FormFieldType.SELECT || field.type === FormFieldType.CHECKBOX) {
        const cleanedOptions = (field.options || []).map(option => option.trim()).filter(Boolean);
        if (cleanedOptions.length === 0) {
          throw new BadRequestException(`Field ${key}: options are required for ${field.type} fields`);
        }
      }

      if (field.type === FormFieldType.RADIO_BUTTON) {
        const cleanedOptions = (field.options || []).map(option => option.trim()).filter(Boolean);
        if (cleanedOptions.length === 0) {
          throw new BadRequestException(`Field ${key}: options are required for RADIO_BUTTON fields`);
        }
      }

      if (field.type === FormFieldType.FILE_UPLOAD) {
        if (field.maxFileSize !== undefined && field.maxFileSize < 1024) {
          throw new BadRequestException(`Field ${key}: maxFileSize must be at least 1024 bytes`);
        }
      }
    });
  }

  private mapFormFieldCreateData(
    registrationLinkId: string,
    fields: LinkFormFieldInputDto[]
  ): Prisma.FormFieldCreateManyInput[] {
    return fields.map((field, index) => {
      const trimmedOptions = field.options?.map(option => option.trim()).filter(Boolean) || [];
      const optionsJson =
        field.type === FormFieldType.SELECT || field.type === FormFieldType.CHECKBOX || field.type === FormFieldType.RADIO_BUTTON
          ? (trimmedOptions as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull;

      const allowedFileTypesJson =
        field.type === FormFieldType.FILE_UPLOAD && field.allowedFileTypes
          ? (field.allowedFileTypes as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull;

      return {
        registrationLinkId,
        key: field.key.trim(),
        label: field.label.trim(),
        type: field.type as FormFieldType,
        required: field.required,
        position: index,
        placeholder: field.placeholder?.trim() || null,
        optionsJson,
        minLength: field.minLength ?? null,
        maxLength: field.maxLength ?? null,
        minValue: field.minValue ?? null,
        maxValue: field.maxValue ?? null,
        pattern: field.pattern?.trim() || null,
        minDate: field.minDate ? new Date(field.minDate) : null,
        maxDate: field.maxDate ? new Date(field.maxDate) : null,
        allowedFileTypesJson,
        maxFileSize: field.maxFileSize ?? null
      };
    });
  }

  async listLinkFormFields(orgCode: string, eventId: string, linkId: string, req: RequestWithAuth) {
    if (!req.auth || !this.policy.canAccessTenant(req.auth, orgCode)) {
      throw new ForbiddenException('Missing tenant access');
    }

    const org = await this.getOrganizationByCode(orgCode);
    const link = await this.prisma.registrationLink.findFirst({
      where: {
        id: linkId,
        eventId,
        organizationId: org.id
      },
      select: { id: true }
    });

    if (!link) {
      throw new NotFoundException('Registration link not found');
    }

    return this.prisma.formField.findMany({
      where: { registrationLinkId: link.id },
      orderBy: { position: 'asc' }
    });
  }

  async updateLinkFormFields(
    orgCode: string,
    eventId: string,
    linkId: string,
    dto: UpdateLinkFormFieldsDto,
    req: RequestWithAuth
  ) {
    this.assertEventWritePermission(orgCode, req);
    this.validateLinkFormFields(dto.fields);

    const org = await this.getOrganizationByCode(orgCode);
    const link = await this.prisma.registrationLink.findFirst({
      where: {
        id: linkId,
        eventId,
        organizationId: org.id
      },
      select: { id: true }
    });

    if (!link) {
      throw new NotFoundException('Registration link not found');
    }

    const createData = this.mapFormFieldCreateData(link.id, dto.fields);

    await this.prisma.$transaction(async tx => {
      await tx.formField.deleteMany({
        where: { registrationLinkId: link.id }
      });

      if (createData.length > 0) {
        await tx.formField.createMany({
          data: createData
        });
      }
    });

    const updatedFields = await this.prisma.formField.findMany({
      where: { registrationLinkId: link.id },
      orderBy: { position: 'asc' }
    });

    await this.audit.write({
      actorUserId: req.auth?.userId || null,
      organizationId: org.id,
      action: 'LINK_UPDATE',
      targetType: 'REGISTRATION_LINK',
      targetId: link.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req)
    });

    return updatedFields;
  }

  async listLinkApprovalRules(orgCode: string, eventId: string, linkId: string, req: RequestWithAuth) {
    if (!req.auth || !this.policy.canAccessTenant(req.auth, orgCode)) {
      throw new ForbiddenException('Missing tenant access');
    }

    const org = await this.getOrganizationByCode(orgCode);
    const link = await this.prisma.registrationLink.findFirst({
      where: {
        id: linkId,
        eventId,
        organizationId: org.id
      },
      select: { id: true }
    });

    if (!link) {
      throw new NotFoundException('Registration link not found');
    }

    return this.getLinkApprovalRules(link.id);
  }

  async updateLinkApprovalRules(
    orgCode: string,
    eventId: string,
    linkId: string,
    dto: UpdateLinkApprovalRulesDto,
    req: RequestWithAuth
  ) {
    this.assertEventWritePermission(orgCode, req);
    this.validateLinkApprovalRules(dto.rules);

    const org = await this.getOrganizationByCode(orgCode);
    const link = await this.prisma.registrationLink.findFirst({
      where: {
        id: linkId,
        eventId,
        organizationId: org.id
      },
      select: { id: true }
    });

    if (!link) {
      throw new NotFoundException('Registration link not found');
    }

    const existingRows = await this.prisma.migrationMetadata.findMany({
      where: {
        key: {
          startsWith: this.linkApprovalRulePrefix(link.id)
        }
      },
      select: {
        key: true
      }
    });

    await this.prisma.$transaction(async tx => {
      for (const row of existingRows) {
        await tx.migrationMetadata.delete({
          where: {
            key: row.key
          }
        });
      }

      for (let index = 0; index < dto.rules.length; index += 1) {
        const rule = dto.rules[index];
        const ruleId = randomUUID();
        await tx.migrationMetadata.create({
          data: {
            key: `${this.linkApprovalRulePrefix(link.id)}${ruleId}`,
            value: JSON.stringify({
              fieldKey: rule.fieldKey.trim(),
              operator: rule.operator,
              value: rule.value?.trim(),
              action: rule.action,
              name: rule.name?.trim(),
              order: rule.order ?? index
            })
          }
        });
      }
    });

    await this.audit.write({
      actorUserId: req.auth?.userId || null,
      organizationId: org.id,
      action: 'LINK_UPDATE',
      targetType: 'REGISTRATION_LINK',
      targetId: link.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req),
      metadataJson: {
        approvalRuleCount: dto.rules.length
      }
    });

    return this.getLinkApprovalRules(link.id);
  }

  async getPublicLinkMetadata(orgCode: string, eventId: string, slug: string) {
    if (!LINK_SLUG_PATTERN.test(slug)) {
      throw new BadRequestException('Invalid link slug format');
    }

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
