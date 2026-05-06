import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AuditOutcome, FormFieldType, LinkVisibility } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../infra/db/prisma.service';
import { AuditService } from '../common/audit.service';
import type { SubmitRegistrationDto } from './dto/submit-registration.dto';

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
  };
  organization: {
    id: string;
    code: string;
    name: string;
  };
  rule: {
    visibility: LinkVisibility;
    capacity: number | null;
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
  }>;
};

@Injectable()
export class RegistrationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
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
            status: true
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
            placeholder: true
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

  private validateCaptcha(token: string): void {
    if (!token || token.trim().length < 8) {
      throw new BadRequestException('Captcha verification failed');
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private toResponseMap(input: SubmitRegistrationDto): Map<string, unknown> {
    return new Map(input.responses.map(item => [item.key, item.value]));
  }

  private validateValue(field: ActiveLink['formFields'][number], rawValue: unknown): string {
    if (rawValue === null || rawValue === undefined) {
      if (field.required) {
        throw new BadRequestException(`Missing value for ${field.key}`);
      }
      return '';
    }

    if (field.type === 'TEXT' || field.type === 'TEXTAREA' || field.type === 'EMAIL' || field.type === 'SELECT') {
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

      if (field.type === 'SELECT' && Array.isArray(field.optionsJson)) {
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

    if (field.type === 'CHECKBOX') {
      if (typeof rawValue !== 'boolean') {
        throw new BadRequestException(`Field ${field.key} must be true or false`);
      }

      if (field.required && rawValue !== true) {
        throw new BadRequestException(`Field ${field.key} must be accepted`);
      }

      return rawValue ? 'true' : 'false';
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

  async resolveLink(slug: string) {
    const link = await this.findActiveLinkBySlug(slug);

    return {
      slug: link.slug,
      title: link.title,
      event: {
        id: link.event.id,
        name: link.event.name,
        status: link.event.status
      },
      organization: {
        code: link.organization.code,
        name: link.organization.name
      }
    };
  }

  async getSchema(slug: string) {
    const link = await this.findActiveLinkBySlug(slug);

    return {
      slug: link.slug,
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
        pattern: field.pattern
      }))
    };
  }

  async submit(slug: string, dto: SubmitRegistrationDto, req: Request) {
    const link = await this.findActiveLinkBySlug(slug);
    this.validateCaptcha(dto.captchaToken);

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

    const referenceCode = await this.nextReferenceCode();
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
        confirmationSentAt: new Date(),
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
        responses: {
          create: responseRows
        }
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
        confirmationTriggered: true,
        policyVersion: dto.consentPolicyVersion
      }
    });

    return {
      referenceCode: created.referenceCode,
      status: 'CONFIRMED'
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
}
