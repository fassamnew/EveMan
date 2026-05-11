import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  AttendeeLifecycleStatus,
  AuditOutcome,
  CommunicationChannel,
  CommunicationDeliveryStatus,
  FormFieldType,
  LinkApprovalMode,
  LinkVisibility
} from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../infra/db/prisma.service';
import { getSystemQueue } from '../../infra/queue/queue.provider';
import { createBadgeSignedDownloadUrl } from '../../infra/storage/badge-storage.util';
import { type WebhookEventType } from '../../infra/webhooks/webhook-config';
import { AuditService } from '../common/audit.service';
import { CaptchaService } from '../common/captcha.service';
import { BadgeQrService } from '../badges/badge-qr.service';
import type { SubmitRegistrationDto } from './dto/submit-registration.dto';
import type { UpdateRegistrationDto } from './dto/update-registration.dto';

type ActiveLink = {
  id: string;
  slug: string;
  title: string;
  organizationId: string;
  eventId: string;
  event: {
    id: string;
    name: string;
    status: string;
    description: string | null;
  };
  organization: {
    id: string;
    code: string;
    name: string;
  };
  rule: {
    visibility: LinkVisibility;
    capacity: number | null;
    approvalMode: LinkApprovalMode;
    opensAt: Date | null;
    closesAt: Date | null;
  } | null;
  formFields: Array<{
    id: string;
    key: string;
    label: string;
    type: FormFieldType;
    required: boolean;
    position: number;
    optionsJson: unknown;
    minLength: number | null;
    maxLength: number | null;
    minValue: number | null;
    maxValue: number | null;
    pattern: string | null;
    placeholder: string | null;
    minDate: Date | null;
    maxDate: Date | null;
    allowedFileTypesJson: unknown;
    maxFileSize: number | null;
  }>;
};

type LinkApprovalRuleRecord = {
  id: string;
  fieldKey: string;
  operator: 'EQ' | 'NEQ' | 'CONTAINS' | 'NOT_CONTAINS' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IS_TRUE' | 'IS_FALSE';
  value?: string;
  action: 'APPROVE' | 'PENDING' | 'REJECT';
  order: number;
  createdAt: string;
};

type LinkAccessSettings = {
  accessMode: 'PUBLIC' | 'INVITE_ONLY' | 'PASSWORD_PROTECTED' | null;
  accessPassword: string | null;
  photoUpload: 'REQUIRED' | 'OPTIONAL' | 'DISABLED' | null;
  confirmationMessage: string | null;
  emailTemplateName: string | null;
  registrationInstructions: string | null;
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

type ResolvedConfirmationTemplate = {
  requestedTemplateName: string | null;
  resolvedTemplateName: string;
  templateResolved: boolean;
};

type ResolvedSmsTemplate = {
  templateId: string | null;
  requestedTemplateName: string | null;
  resolvedTemplateName: string | null;
  templateResolved: boolean;
};

@Injectable()
export class RegistrationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CaptchaService) private readonly captcha: CaptchaService,
    @Inject(BadgeQrService) private readonly badgeQr: BadgeQrService
  ) {}

  private async findActiveLinkBySlug(slug: string): Promise<ActiveLink> {
    const candidates = await this.prisma.registrationLink.findMany({
      where: {
        slug,
        isActive: true,
        event: {
          status: {
            not: 'ARCHIVED'
          }
        },
        OR: [
          {
            rule: {
              is: null
            }
          },
          {
            rule: {
              is: {
                visibility: {
                  in: ['PUBLIC', 'UNLISTED']
                }
              }
            }
          }
        ]
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            status: true,
            description: true
          }
        },
        organization: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        rule: {
          select: {
            visibility: true,
            capacity: true,
            approvalMode: true,
            opensAt: true,
            closesAt: true
          }
        },
        formFields: {
          orderBy: {
            position: 'asc'
          },
          select: {
            id: true,
            key: true,
            label: true,
            type: true,
            required: true,
            position: true,
            optionsJson: true,
            minLength: true,
            maxLength: true,
            minValue: true,
            maxValue: true,
            pattern: true,
            placeholder: true,
            minDate: true,
            maxDate: true,
            allowedFileTypesJson: true,
            maxFileSize: true
          }
        }
      },
      take: 2
    });

    if (candidates.length === 0) {
      throw new NotFoundException('Registration link not found');
    }

    if (candidates.length > 1) {
      throw new BadRequestException('Registration link slug is ambiguous');
    }

    const link = candidates[0];
    const now = Date.now();
    const opensAt = link.rule?.opensAt?.getTime();
    const closesAt = link.rule?.closesAt?.getTime();

    if (opensAt && opensAt > now) {
      throw new BadRequestException('Registration link is not open yet');
    }

    if (closesAt && closesAt < now) {
      throw new BadRequestException('Registration link is closed');
    }

    return link as ActiveLink;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private toResponseMap(input: SubmitRegistrationDto): Map<string, unknown> {
    return new Map(input.responses.map(item => [item.key, item.value]));
  }

  private linkApprovalRulePrefix(linkId: string): string {
    return `link:${linkId}:approval-rule:`;
  }

  private linkSettingsPrefix(linkId: string): string {
    return `link:${linkId}:settings:`;
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

  private async getLinkAccessSettings(linkId: string): Promise<LinkAccessSettings> {
    const rows = await this.prisma.migrationMetadata.findMany({
      where: {
        key: {
          startsWith: this.linkSettingsPrefix(linkId)
        }
      }
    });

    const valueByKey = new Map(rows.map(row => [row.key.replace(this.linkSettingsPrefix(linkId), ''), row.value]));
    const accessModeRaw = valueByKey.get('accessMode');
    const photoUploadRaw = valueByKey.get('photoUpload');
    const pageTemplateRaw = valueByKey.get('pageTemplate');
    const formLayoutRaw = valueByKey.get('formLayout');
    const accessMode =
      accessModeRaw === 'PUBLIC' || accessModeRaw === 'INVITE_ONLY' || accessModeRaw === 'PASSWORD_PROTECTED'
        ? accessModeRaw
        : null;
    const photoUpload =
      photoUploadRaw === 'REQUIRED' || photoUploadRaw === 'OPTIONAL' || photoUploadRaw === 'DISABLED'
        ? photoUploadRaw
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
      accessMode,
      accessPassword: valueByKey.get('accessPassword') || null,
      photoUpload,
      confirmationMessage: valueByKey.get('confirmationMessage') || null,
      emailTemplateName: valueByKey.get('emailTemplateName') || null,
      registrationInstructions: valueByKey.get('registrationInstructions') || null,
      allowRegistrantUpdate: valueByKey.get('allowRegistrantUpdate') === '1',
      smsDeliveryEnabled: valueByKey.get('smsDeliveryEnabled') === '1',
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

  private async resolveConfirmationTemplate(input: {
    organizationId: string;
    requestedTemplateName: string | null;
  }): Promise<ResolvedConfirmationTemplate> {
    const requested = input.requestedTemplateName?.trim() || null;
    if (!requested) {
      return {
        requestedTemplateName: null,
        resolvedTemplateName: 'default-registration-confirmation',
        templateResolved: false
      };
    }

    const matched = await this.prisma.communicationTemplate.findFirst({
      where: {
        organizationId: input.organizationId,
        channel: CommunicationChannel.EMAIL,
        isActive: true,
        name: requested
      },
      select: {
        id: true,
        name: true
      }
    });

    if (!matched) {
      return {
        requestedTemplateName: requested,
        resolvedTemplateName: 'default-registration-confirmation',
        templateResolved: false
      };
    }

    return {
      requestedTemplateName: requested,
      resolvedTemplateName: matched.name,
      templateResolved: true
    };
  }

  private async resolveSmsTemplate(input: {
    organizationId: string;
    requestedTemplateName: string | null;
  }): Promise<ResolvedSmsTemplate> {
    const requested = input.requestedTemplateName?.trim() || null;

    if (requested) {
      const exact = await this.prisma.communicationTemplate.findFirst({
        where: {
          organizationId: input.organizationId,
          channel: CommunicationChannel.SMS,
          isActive: true,
          name: requested
        },
        select: {
          id: true,
          name: true
        }
      });

      if (!exact) {
        return {
          templateId: null,
          requestedTemplateName: requested,
          resolvedTemplateName: null,
          templateResolved: false
        };
      }

      return {
        templateId: exact.id,
        requestedTemplateName: requested,
        resolvedTemplateName: exact.name,
        templateResolved: true
      };
    }

    const fallback = await this.prisma.communicationTemplate.findFirst({
      where: {
        organizationId: input.organizationId,
        channel: CommunicationChannel.SMS,
        isActive: true
      },
      select: {
        id: true,
        name: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    if (!fallback) {
      return {
        templateId: null,
        requestedTemplateName: null,
        resolvedTemplateName: null,
        templateResolved: false
      };
    }

    return {
      templateId: fallback.id,
      requestedTemplateName: null,
      resolvedTemplateName: fallback.name,
      templateResolved: true
    };
  }

  private assertLinkAccess(input: {
    settings: LinkAccessSettings;
    accessPassword?: string;
    inviteToken?: string;
  }): void {
    if (!input.settings.accessMode || input.settings.accessMode === 'PUBLIC') {
      return;
    }

    if (input.settings.accessMode === 'PASSWORD_PROTECTED') {
      if (!input.settings.accessPassword || input.accessPassword !== input.settings.accessPassword) {
        throw new ForbiddenException('Registration link password is required or invalid');
      }
      return;
    }

    if (!input.settings.accessPassword || input.inviteToken !== input.settings.accessPassword) {
      throw new ForbiddenException('Valid invite token is required for this registration link');
    }
  }

  private assertPhotoUploadPolicy(input: { settings: LinkAccessSettings; photoUrl?: string }): string | null {
    const normalizedPhotoUrl = input.photoUrl?.trim() || '';

    if (input.settings.photoUpload === 'REQUIRED' && normalizedPhotoUrl.length === 0) {
      throw new BadRequestException('Photo upload is required for this registration link');
    }

    if (input.settings.photoUpload === 'DISABLED' && normalizedPhotoUrl.length > 0) {
      throw new BadRequestException('Photo upload is disabled for this registration link');
    }

    return normalizedPhotoUrl.length > 0 ? normalizedPhotoUrl : null;
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
          order: parsed.order ?? 0,
          createdAt: row.createdAt.toISOString()
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

  private evaluateRuleMatch(rule: LinkApprovalRuleRecord, responseMap: Map<string, unknown>): boolean {
    const raw = responseMap.get(rule.fieldKey);

    switch (rule.operator) {
      case 'IS_TRUE':
        return raw === true || String(raw).toLowerCase() === 'true';
      case 'IS_FALSE':
        return raw === false || String(raw).toLowerCase() === 'false';
      case 'EQ':
        return String(raw ?? '') === String(rule.value ?? '');
      case 'NEQ':
        return String(raw ?? '') !== String(rule.value ?? '');
      case 'CONTAINS':
        return String(raw ?? '').toLowerCase().includes(String(rule.value ?? '').toLowerCase());
      case 'NOT_CONTAINS':
        return !String(raw ?? '').toLowerCase().includes(String(rule.value ?? '').toLowerCase());
      case 'GT': {
        const left = Number(raw);
        const right = Number(rule.value);
        return Number.isFinite(left) && Number.isFinite(right) && left > right;
      }
      case 'GTE': {
        const left = Number(raw);
        const right = Number(rule.value);
        return Number.isFinite(left) && Number.isFinite(right) && left >= right;
      }
      case 'LT': {
        const left = Number(raw);
        const right = Number(rule.value);
        return Number.isFinite(left) && Number.isFinite(right) && left < right;
      }
      case 'LTE': {
        const left = Number(raw);
        const right = Number(rule.value);
        return Number.isFinite(left) && Number.isFinite(right) && left <= right;
      }
      default:
        return false;
    }
  }

  private resolveLifecycleStatus(input: {
    approvalMode: LinkApprovalMode;
    rules: LinkApprovalRuleRecord[];
    responseMap: Map<string, unknown>;
  }): { status: AttendeeLifecycleStatus; matchedRuleId: string | null } {
    for (const rule of input.rules) {
      if (!this.evaluateRuleMatch(rule, input.responseMap)) {
        continue;
      }

      if (rule.action === 'APPROVE') {
        return { status: AttendeeLifecycleStatus.APPROVED, matchedRuleId: rule.id };
      }

      if (rule.action === 'REJECT') {
        return { status: AttendeeLifecycleStatus.REJECTED, matchedRuleId: rule.id };
      }

      return { status: AttendeeLifecycleStatus.PENDING, matchedRuleId: rule.id };
    }

    return {
      status: input.approvalMode === LinkApprovalMode.MANUAL ? AttendeeLifecycleStatus.PENDING : AttendeeLifecycleStatus.APPROVED,
      matchedRuleId: null
    };
  }

  private validateValue(field: ActiveLink['formFields'][number], rawValue: unknown): string {
    if (rawValue === null || rawValue === undefined) {
      if (field.required) {
        throw new BadRequestException(`Missing value for ${field.key}`);
      }
      return '';
    }

    if (field.type === 'TEXT' || field.type === 'TEXTAREA' || field.type === 'EMAIL' || field.type === 'SELECT' || field.type === 'RADIO_BUTTON') {
      if (typeof rawValue !== 'string') {
        throw new BadRequestException(`Field ${field.key} must be a string`);
      }

      const value = rawValue.trim();
      if (field.required && value.length === 0) {
        throw new BadRequestException(`Field ${field.key} is required`);
      }

      if (field.minLength !== null && value.length < field.minLength) {
        throw new BadRequestException(`Field ${field.key} is shorter than minimum length`);
      }

      if (field.maxLength !== null && value.length > field.maxLength) {
        throw new BadRequestException(`Field ${field.key} is longer than maximum length`);
      }

      if (field.type === 'EMAIL') {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(value)) {
          throw new BadRequestException(`Field ${field.key} must be a valid email`);
        }
      }

      if ((field.type === 'SELECT' || field.type === 'RADIO_BUTTON') && Array.isArray(field.optionsJson)) {
        const options = field.optionsJson.filter(option => typeof option === 'string');
        if (options.length > 0 && !options.includes(value)) {
          throw new BadRequestException(`Field ${field.key} must be one of the configured options`);
        }
      }

      if (field.pattern) {
        const re = new RegExp(field.pattern);
        if (!re.test(value)) {
          throw new BadRequestException(`Field ${field.key} has invalid format`);
        }
      }

      return value;
    }

    if (field.type === 'NUMBER') {
      const parsed = typeof rawValue === 'number' ? rawValue : Number(rawValue);
      if (!Number.isFinite(parsed)) {
        throw new BadRequestException(`Field ${field.key} must be numeric`);
      }

      if (field.minValue !== null && parsed < field.minValue) {
        throw new BadRequestException(`Field ${field.key} is below minimum value`);
      }

      if (field.maxValue !== null && parsed > field.maxValue) {
        throw new BadRequestException(`Field ${field.key} is above maximum value`);
      }

      return String(parsed);
    }

    if (field.type === 'DATE') {
      if (typeof rawValue !== 'string') {
        throw new BadRequestException(`Field ${field.key} must be a date string`);
      }

      const dateValue = new Date(rawValue);
      if (isNaN(dateValue.getTime())) {
        throw new BadRequestException(`Field ${field.key} must be a valid date`);
      }

      if (field.minDate !== null && dateValue < new Date(field.minDate)) {
        throw new BadRequestException(`Field ${field.key} is before minimum date`);
      }

      if (field.maxDate !== null && dateValue > new Date(field.maxDate)) {
        throw new BadRequestException(`Field ${field.key} is after maximum date`);
      }

      return rawValue;
    }

    if (field.type === 'CHECKBOX') {
      if (typeof rawValue !== 'boolean') {
        throw new BadRequestException(`Field ${field.key} must be true or false`);
      }

      if (field.required && rawValue !== true) {
        throw new BadRequestException(`Field ${field.key} must be accepted`);
      }

      return rawValue ? 'true' : 'false';
    }

    if (field.type === 'FILE_UPLOAD') {
      if (typeof rawValue !== 'string') {
        throw new BadRequestException(`Field ${field.key} must be a URL string`);
      }

      // File uploads are validated at the upload endpoint
      // Here we just validate the URL format
      try {
        new URL(rawValue);
      } catch {
        throw new BadRequestException(`Field ${field.key} must be a valid URL`);
      }

      return rawValue;
    }

    if (field.type === 'PHOTO_UPLOAD') {
      if (typeof rawValue !== 'string') {
        throw new BadRequestException(`Field ${field.key} must be a URL string`);
      }

      // Photo uploads are validated at the upload endpoint
      // Here we just validate the URL format
      try {
        new URL(rawValue);
      } catch {
        throw new BadRequestException(`Field ${field.key} must be a valid URL`);
      }

      return rawValue;
    }

    throw new BadRequestException(`Unsupported field type for ${field.key}`);
  }

  private async nextReferenceCode(): Promise<string> {
    for (let i = 0; i < 8; i += 1) {
      const value = Math.random().toString(36).slice(2, 10).toUpperCase();
      const existing = await this.prisma.registrant.findUnique({ where: { referenceCode: value } });
      if (!existing) {
        return value;
      }
    }

    throw new BadRequestException('Unable to generate unique reference code');
  }

  private async triggerConfirmationEmail(input: {
    registrantId: string;
    organizationId: string;
    referenceCode: string;
    email: string;
    fullName: string;
    eventName: string;
    linkTitle: string;
    templateName: string;
    confirmationMessage: string | null;
  }): Promise<boolean> {
    try {
      const queue = getSystemQueue();
      await queue.add('registration.confirmation-email', input, {
        removeOnComplete: 100,
        removeOnFail: 100
      });
      return true;
    } catch {
      return false;
    }
  }

  private mapLifecycleToWebhookEvent(status: AttendeeLifecycleStatus): WebhookEventType {
    if (status === AttendeeLifecycleStatus.REJECTED) {
      return 'REGISTRATION_REJECTED';
    }

    if (status === AttendeeLifecycleStatus.PENDING) {
      return 'REGISTRATION_PENDING';
    }

    return 'REGISTRATION_CONFIRMED';
  }

  private async triggerWebhookDispatch(input: {
    organizationId: string;
    eventType: WebhookEventType;
    payload: Record<string, unknown>;
  }): Promise<boolean> {
    try {
      const queue = getSystemQueue();
      await queue.add(
        'webhook.dispatch',
        {
          organizationId: input.organizationId,
          eventType: input.eventType,
          payload: input.payload,
          occurredAt: new Date().toISOString()
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
      return true;
    } catch {
      return false;
    }
  }

  private async triggerBadgeQrDelivery(registrantId: string): Promise<{ qrIssued: boolean; badgeDeliveryQueued: boolean }> {
    try {
      await this.badgeQr.issueForRegistrant({ registrantId });
      return {
        qrIssued: true,
        badgeDeliveryQueued: true
      };
    } catch {
      return {
        qrIssued: false,
        badgeDeliveryQueued: false
      };
    }
  }

  private async triggerOptionalSmsDelivery(input: {
    organizationId: string;
    registrantId: string;
    accessSettings: LinkAccessSettings;
    responseRows: Array<{ formFieldId: string | null; fieldKey: string; valueText: string }>;
  }): Promise<{ smsQueued: boolean; smsTemplateName: string | null; smsTemplateResolved: boolean }> {
    if (!input.accessSettings.smsDeliveryEnabled) {
      return {
        smsQueued: false,
        smsTemplateName: null,
        smsTemplateResolved: false
      };
    }

    const recipientFieldKey = input.accessSettings.smsRecipientFieldKey?.trim() || 'phone';
    const recipientPhone =
      input.responseRows.find(row => row.fieldKey === recipientFieldKey)?.valueText.trim() || '';

    if (!recipientPhone) {
      return {
        smsQueued: false,
        smsTemplateName: null,
        smsTemplateResolved: false
      };
    }

    const resolved = await this.resolveSmsTemplate({
      organizationId: input.organizationId,
      requestedTemplateName: input.accessSettings.smsTemplateName
    });

    if (!resolved.templateId) {
      return {
        smsQueued: false,
        smsTemplateName: resolved.resolvedTemplateName,
        smsTemplateResolved: false
      };
    }

    try {
      const log = await this.prisma.communicationLog.create({
        data: {
          organizationId: input.organizationId,
          registrantId: input.registrantId,
          templateId: resolved.templateId,
          channel: CommunicationChannel.SMS,
          status: CommunicationDeliveryStatus.QUEUED,
          senderUserId: null,
          recipientAddress: recipientPhone,
          metadataJson: {
            source: 'registration.submit'
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
        smsQueued: true,
        smsTemplateName: resolved.resolvedTemplateName,
        smsTemplateResolved: resolved.templateResolved
      };
    } catch {
      return {
        smsQueued: false,
        smsTemplateName: resolved.resolvedTemplateName,
        smsTemplateResolved: resolved.templateResolved
      };
    }
  }

  async resolveLink(slug: string, access?: { accessPassword?: string; inviteToken?: string }) {
    const link = await this.findActiveLinkBySlug(slug);
    const accessSettings = await this.getLinkAccessSettings(link.id);
    this.assertLinkAccess({
      settings: accessSettings,
      accessPassword: access?.accessPassword,
      inviteToken: access?.inviteToken
    });

    return {
      slug: link.slug,
      title: link.title,
      event: {
        id: link.event.id,
        name: link.event.name,
        status: link.event.status,
        description: accessSettings.pageEventDescription || link.event.description
      },
      organization: {
        code: link.organization.code,
        name: link.organization.name
      },
      registrationInstructions: accessSettings.registrationInstructions,
      pageDesign: {
        template: accessSettings.pageTemplate,
        logoUrl: accessSettings.pageLogoUrl,
        bannerImageUrl: accessSettings.pageBannerImageUrl,
        backgroundColor: accessSettings.pageBackgroundColor,
        buttonColor: accessSettings.pageButtonColor,
        fontFamily: accessSettings.pageFontFamily,
        sponsorLogoUrls: accessSettings.sponsorLogoUrls,
        formLayout: accessSettings.formLayout,
        footerText: accessSettings.footerText,
        privacyNotice: accessSettings.privacyNotice,
        termsAndConditions: accessSettings.termsAndConditions,
        confirmationMessage: accessSettings.confirmationMessage
      }
    };
  }

  async getSchema(slug: string, access?: { accessPassword?: string; inviteToken?: string }) {
    const link = await this.findActiveLinkBySlug(slug);
    const accessSettings = await this.getLinkAccessSettings(link.id);
    this.assertLinkAccess({
      settings: accessSettings,
      accessPassword: access?.accessPassword,
      inviteToken: access?.inviteToken
    });

    return {
      slug: link.slug,
      photoUpload: accessSettings.photoUpload || 'OPTIONAL',
      registrationInstructions: accessSettings.registrationInstructions,
      pageDesign: {
        template: accessSettings.pageTemplate,
        logoUrl: accessSettings.pageLogoUrl,
        bannerImageUrl: accessSettings.pageBannerImageUrl,
        backgroundColor: accessSettings.pageBackgroundColor,
        buttonColor: accessSettings.pageButtonColor,
        fontFamily: accessSettings.pageFontFamily,
        sponsorLogoUrls: accessSettings.sponsorLogoUrls,
        formLayout: accessSettings.formLayout,
        footerText: accessSettings.footerText,
        privacyNotice: accessSettings.privacyNotice,
        termsAndConditions: accessSettings.termsAndConditions,
        confirmationMessage: accessSettings.confirmationMessage
      },
      fields: link.formFields.map(field => ({
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
        position: field.position,
        placeholder: field.placeholder,
        options: Array.isArray(field.optionsJson) ? field.optionsJson : [],
        minLength: field.minLength,
        maxLength: field.maxLength,
        minValue: field.minValue,
        maxValue: field.maxValue,
        pattern: field.pattern,
        minDate: field.minDate ? field.minDate.toISOString() : null,
        maxDate: field.maxDate ? field.maxDate.toISOString() : null,
        allowedFileTypes: Array.isArray(field.allowedFileTypesJson) ? field.allowedFileTypesJson : [],
        maxFileSize: field.maxFileSize
      }))
    };
  }

  async submit(slug: string, dto: SubmitRegistrationDto, req: Request) {
    const link = await this.findActiveLinkBySlug(slug);
    const accessSettings = await this.getLinkAccessSettings(link.id);
    this.assertLinkAccess({
      settings: accessSettings,
      accessPassword: dto.accessPassword,
      inviteToken: dto.inviteToken
    });
    const normalizedPhotoUrl = this.assertPhotoUploadPolicy({
      settings: accessSettings,
      photoUrl: dto.photoUrl
    });

    const captchaOk = await this.captcha.verifyToken(dto.captchaToken, req.ip || null);
    if (!captchaOk) {
      throw new BadRequestException('Captcha verification failed');
    }

    if (!dto.consentAccepted) {
      throw new BadRequestException('Consent is required');
    }

    const normalizedEmail = this.normalizeEmail(dto.email);
    const existing = await this.prisma.registrant.findFirst({
      where: {
        registrationLinkId: link.id,
        email: normalizedEmail
      },
      select: {
        id: true,
        referenceCode: true
      }
    });

    if (existing) {
      throw new ConflictException({
        message: 'A registration already exists for this email and link',
        existingReferenceCode: existing.referenceCode
      });
    }

    const registrationCount = await this.prisma.registrant.count({
      where: {
        registrationLinkId: link.id
      }
    });

    if (link.rule?.capacity !== null && link.rule?.capacity !== undefined && registrationCount >= link.rule.capacity) {
      throw new BadRequestException('Registration capacity reached');
    }

    const responseMap = this.toResponseMap(dto);
    const knownKeys = new Set(link.formFields.map(field => field.key));

    for (const key of responseMap.keys()) {
      if (!knownKeys.has(key) && link.formFields.length > 0) {
        throw new BadRequestException(`Unknown field key: ${key}`);
      }
    }

    const responseRows: Array<{ formFieldId: string | null; fieldKey: string; valueText: string }> = [];

    for (const field of link.formFields) {
      const validated = this.validateValue(field, responseMap.get(field.key));
      if (validated.length > 0 || field.required) {
        responseRows.push({
          formFieldId: field.id,
          fieldKey: field.key,
          valueText: validated
        });
      }
    }

    if (normalizedPhotoUrl) {
      responseRows.push({
        formFieldId: null,
        fieldKey: '__photo_upload__',
        valueText: normalizedPhotoUrl
      });
    }

    const referenceCode = await this.nextReferenceCode();
    const confirmationTemplate = await this.resolveConfirmationTemplate({
      organizationId: link.organizationId,
      requestedTemplateName: accessSettings.emailTemplateName
    });
    const approvalRules = await this.getLinkApprovalRules(link.id);
    const lifecycleDecision = this.resolveLifecycleStatus({
      approvalMode: link.rule?.approvalMode || LinkApprovalMode.AUTO,
      rules: approvalRules,
      responseMap
    });

    const created = await this.prisma.registrant.create({
      data: {
        organizationId: link.organizationId,
        eventId: link.eventId,
        registrationLinkId: link.id,
        referenceCode,
        email: normalizedEmail,
        fullName: dto.fullName,
        consentAccepted: true,
        consentPolicyVersion: dto.consentPolicyVersion,
        consentCapturedAt: new Date(),
        lifecycleStatus: lifecycleDecision.status,
        lifecycleUpdatedAt: new Date(),
        confirmationSentAt: new Date(),
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
        responses: {
          create: responseRows
        }
      },
      include: {
        event: {
          select: {
            name: true
          }
        },
        registrationLink: {
          select: {
            title: true
          }
        }
      }
    });

    const confirmationQueued = await this.triggerConfirmationEmail({
      registrantId: created.id,
      organizationId: link.organizationId,
      referenceCode: created.referenceCode,
      email: created.email,
      fullName: created.fullName,
      eventName: created.event.name,
      linkTitle: created.registrationLink.title,
      templateName: confirmationTemplate.resolvedTemplateName,
      confirmationMessage: accessSettings.confirmationMessage
    });

    const deliveryResult =
      created.lifecycleStatus === AttendeeLifecycleStatus.APPROVED
        ? await this.triggerBadgeQrDelivery(created.id)
        : {
            qrIssued: false,
            badgeDeliveryQueued: false
          };

    const smsDelivery =
      created.lifecycleStatus === AttendeeLifecycleStatus.APPROVED
        ? await this.triggerOptionalSmsDelivery({
            organizationId: link.organizationId,
            registrantId: created.id,
            accessSettings,
            responseRows
          })
        : {
            smsQueued: false,
            smsTemplateName: null,
            smsTemplateResolved: false
          };

    const webhookEventType = this.mapLifecycleToWebhookEvent(created.lifecycleStatus);
    const webhookTriggered = await this.triggerWebhookDispatch({
      organizationId: link.organizationId,
      eventType: webhookEventType,
      payload: {
        registrantId: created.id,
        referenceCode: created.referenceCode,
        lifecycleStatus: created.lifecycleStatus,
        email: created.email,
        fullName: created.fullName,
        registrationLinkId: link.id,
        registrationLinkSlug: link.slug,
        registrationLinkTitle: created.registrationLink.title,
        eventId: link.eventId,
        eventName: created.event.name,
        organizationId: link.organizationId,
        organizationCode: link.organization.code
      }
    });

    await this.audit.write({
      actorUserId: null,
      organizationId: link.organizationId,
      action: 'REGISTRATION_SUBMIT',
      targetType: 'REGISTRANT',
      targetId: created.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: req.ip || null,
      metadataJson: {
        confirmationTriggered: confirmationQueued,
        confirmationTemplateRequested: confirmationTemplate.requestedTemplateName,
        confirmationTemplateName: confirmationTemplate.resolvedTemplateName,
        confirmationTemplateResolved: confirmationTemplate.templateResolved,
        confirmationMessage: accessSettings.confirmationMessage,
        qrIssued: deliveryResult.qrIssued,
        badgeDeliveryQueued: deliveryResult.badgeDeliveryQueued,
        smsQueued: smsDelivery.smsQueued,
        smsTemplateName: smsDelivery.smsTemplateName,
        smsTemplateResolved: smsDelivery.smsTemplateResolved,
        webhookTriggered,
        webhookEventType,
        policyVersion: dto.consentPolicyVersion,
        matchedApprovalRuleId: lifecycleDecision.matchedRuleId
      }
    });

    return {
      referenceCode: created.referenceCode,
      status: created.lifecycleStatus === AttendeeLifecycleStatus.PENDING
        ? 'PENDING_APPROVAL'
        : created.lifecycleStatus === AttendeeLifecycleStatus.REJECTED
          ? 'REJECTED'
          : 'CONFIRMED',
      confirmationQueued,
      confirmationMessage: accessSettings.confirmationMessage,
      qrIssued: deliveryResult.qrIssued,
      badgeDeliveryQueued: deliveryResult.badgeDeliveryQueued,
      smsQueued: smsDelivery.smsQueued
    };
  }

  async retrieve(referenceCode: string, email: string) {
    const registrant = await this.prisma.registrant.findFirst({
      where: {
        referenceCode,
        email: this.normalizeEmail(email)
      },
      include: {
        registrationLink: {
          select: {
            slug: true,
            title: true
          }
        },
        event: {
          select: {
            id: true,
            name: true
          }
        },
        organization: {
          select: {
            code: true,
            name: true
          }
        }
      }
    });

    if (!registrant) {
      throw new NotFoundException('Registrant not found');
    }

    return {
      referenceCode: registrant.referenceCode,
      fullName: registrant.fullName,
      email: registrant.email,
      event: registrant.event,
      link: registrant.registrationLink,
      organization: registrant.organization,
      badgeRedownloadUrl: `/register/retrieve?referenceCode=${registrant.referenceCode}&email=${encodeURIComponent(registrant.email)}`
    };
  }

  async updateSubmission(slug: string, referenceCode: string, dto: UpdateRegistrationDto, req: Request) {
    const link = await this.findActiveLinkBySlug(slug);
    const accessSettings = await this.getLinkAccessSettings(link.id);

    if (!accessSettings.allowRegistrantUpdate) {
      throw new ForbiddenException('Registrant updates are disabled for this registration link');
    }

    this.assertLinkAccess({
      settings: accessSettings,
      accessPassword: dto.accessPassword,
      inviteToken: dto.inviteToken
    });

    const registrant = await this.prisma.registrant.findFirst({
      where: {
        registrationLinkId: link.id,
        referenceCode,
        email: this.normalizeEmail(dto.email)
      },
      include: {
        responses: true
      }
    });

    if (!registrant) {
      throw new NotFoundException('Registrant not found');
    }

    const existingPhotoUrl =
      registrant.responses.find(response => response.fieldKey === '__photo_upload__')?.valueText || undefined;
    const effectivePhotoUrl = dto.photoUrl === undefined ? existingPhotoUrl : dto.photoUrl;
    const normalizedPhotoUrl = this.assertPhotoUploadPolicy({
      settings: accessSettings,
      photoUrl: effectivePhotoUrl
    });

    const updates: Array<Promise<unknown>> = [
      this.prisma.registrant.update({
        where: { id: registrant.id },
        data: {
          fullName: dto.fullName?.trim() || undefined,
          lifecycleUpdatedAt: new Date()
        }
      })
    ];

    if (dto.responses) {
      const responseMap = new Map(dto.responses.map(item => [item.key, item.value]));
      const knownKeys = new Set(link.formFields.map(field => field.key));

      for (const key of responseMap.keys()) {
        if (!knownKeys.has(key) && link.formFields.length > 0) {
          throw new BadRequestException(`Unknown field key: ${key}`);
        }
      }

      const responseRows: Array<{ formFieldId: string | null; fieldKey: string; valueText: string }> = [];
      for (const field of link.formFields) {
        const validated = this.validateValue(field, responseMap.get(field.key));
        if (validated.length > 0 || field.required) {
          responseRows.push({
            formFieldId: field.id,
            fieldKey: field.key,
            valueText: validated
          });
        }
      }

      if (normalizedPhotoUrl) {
        responseRows.push({
          formFieldId: null,
          fieldKey: '__photo_upload__',
          valueText: normalizedPhotoUrl
        });
      }

      updates.push(
        this.prisma.registrantResponse.deleteMany({
          where: {
            registrantId: registrant.id,
            fieldKey: {
              in: [...knownKeys, '__photo_upload__']
            }
          }
        })
      );

      if (responseRows.length > 0) {
        updates.push(
          this.prisma.registrantResponse.createMany({
            data: responseRows.map(row => ({
              registrantId: registrant.id,
              formFieldId: row.formFieldId,
              fieldKey: row.fieldKey,
              valueText: row.valueText
            }))
          })
        );
      }
    } else if (dto.photoUrl !== undefined) {
      if (normalizedPhotoUrl) {
        updates.push(
          this.prisma.registrantResponse.upsert({
            where: {
              registrantId_fieldKey: {
                registrantId: registrant.id,
                fieldKey: '__photo_upload__'
              }
            },
            update: {
              valueText: normalizedPhotoUrl
            },
            create: {
              registrantId: registrant.id,
              formFieldId: null,
              fieldKey: '__photo_upload__',
              valueText: normalizedPhotoUrl
            }
          })
        );
      } else {
        updates.push(
          this.prisma.registrantResponse.deleteMany({
            where: {
              registrantId: registrant.id,
              fieldKey: '__photo_upload__'
            }
          })
        );
      }
    }

    await Promise.all(updates);

    await this.audit.write({
      actorUserId: null,
      organizationId: link.organizationId,
      action: 'REGISTRATION_UPDATE',
      targetType: 'REGISTRANT',
      targetId: registrant.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: req.ip || null,
      metadataJson: {
        viaPublicSelfService: true,
        updatedFields: {
          fullName: dto.fullName !== undefined,
          responses: dto.responses !== undefined,
          photoUrl: dto.photoUrl !== undefined
        }
      }
    });

    return {
      referenceCode: registrant.referenceCode,
      updated: true
    };
  }

  async getBadge(referenceCode: string, email: string) {
    const registrant = await this.prisma.registrant.findFirst({
      where: {
        referenceCode,
        email: this.normalizeEmail(email)
      },
      include: {
        event: {
          select: {
            name: true
          }
        },
        organization: {
          select: {
            code: true,
            name: true
          }
        }
      }
    });

    if (!registrant) {
      throw new NotFoundException('Registrant not found');
    }

    let badgeDeliveryQueued = false;
    let latestBadge = await this.prisma.badge.findFirst({
      where: {
        registrantId: registrant.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!latestBadge && registrant.lifecycleStatus === AttendeeLifecycleStatus.APPROVED) {
      try {
        await this.badgeQr.issueForRegistrant({ registrantId: registrant.id });
        badgeDeliveryQueued = true;
      } catch {
        // Fallback to text-only response if badge issuance cannot be triggered.
      }

      latestBadge = await this.prisma.badge.findFirst({
        where: {
          registrantId: registrant.id
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    }

    if (latestBadge?.status === 'FAILED') {
      try {
        await this.badgeQr.regenerateBadge({
          orgCode: registrant.organization.code,
          registrantId: registrant.id
        });
        badgeDeliveryQueued = true;
      } catch {
        // Keep returning current badge status even if requeue fails.
      }

      latestBadge = await this.prisma.badge.findFirst({
        where: {
          registrantId: registrant.id
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    }

    const readyBadge = await this.prisma.badge.findFirst({
      where: {
        registrantId: registrant.id,
        status: 'READY',
        storagePath: {
          not: null
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    const badgeDownloadUrl = readyBadge?.storagePath
      ? await createBadgeSignedDownloadUrl({
          storagePath: readyBadge.storagePath,
          expiresInSeconds: 300
        })
      : null;

    return {
      referenceCode: registrant.referenceCode,
      fullName: registrant.fullName,
      eventName: registrant.event.name,
      organizationName: registrant.organization.name,
      badgeStatus: readyBadge?.status || latestBadge?.status || 'PENDING',
      badgeDownloadUrl,
      badgeDeliveryQueued,
      badgeText: [
        'EveMange Registration Badge',
        `Reference: ${registrant.referenceCode}`,
        `Name: ${registrant.fullName}`,
        `Email: ${registrant.email}`,
        `Event: ${registrant.event.name}`,
        `Organization: ${registrant.organization.name}`
      ].join('\n')
    };
  }
}
