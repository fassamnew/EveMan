import 'reflect-metadata';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../infra/db/prisma.service';
import { PasswordService } from '../common/password.service';
import { IdentityBootstrapService } from '../organizations/identity-bootstrap.service';

const runIntegration = Boolean(process.env.DATABASE_URL);
const SYSTEM_ROLES: Array<{ name: RoleName; description: string }> = [
  { name: 'SUPER_ADMIN', description: 'Platform super administrator' },
  { name: 'ORG_ADMIN', description: 'Organization administrator' },
  { name: 'ORG_STAFF', description: 'Organization staff member' }
];

describe.skipIf(!runIntegration)('Section 4 compliance integration (MySQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  async function ensureSystemRoles(): Promise<void> {
    for (const role of SYSTEM_ROLES) {
      const existing = await prisma.role.findFirst({
        where: { name: role.name, organizationId: null }
      });
      if (existing) {
        await prisma.role.update({
          where: { id: existing.id },
          data: {
            description: role.description,
            isSystem: true
          }
        });
      } else {
        await prisma.role.create({
          data: {
            name: role.name,
            description: role.description,
            isSystem: true,
            organizationId: null
          }
        });
      }
    }
  }

  async function clearTenantData(): Promise<void> {
    await prisma.migrationMetadata.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.communicationLog.deleteMany();
    await prisma.communicationTemplate.deleteMany();
    await prisma.registrantResponse.deleteMany();
    await prisma.registrant.deleteMany();
    await prisma.formField.deleteMany();
    await prisma.linkRule.deleteMany();
    await prisma.registrationLink.deleteMany();
    await prisma.event.deleteMany();
    await prisma.invite.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
  }

  async function getRoleId(name: RoleName): Promise<string> {
    const role = await prisma.role.findFirst({
      where: {
        name,
        organizationId: null
      }
    });
    if (!role) {
      throw new Error(`Missing role ${name}`);
    }
    return role.id;
  }

  async function createOrgUser(input: {
    email: string;
    password: string;
    orgId: string;
    roleName: RoleName;
  }): Promise<void> {
    const roleId = await getRoleId(input.roleName);
    const hash = await passwordService.hash(input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: hash,
        isActive: true
      }
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId,
        organizationId: input.orgId
      }
    });
  }

  async function loginOrgUser(input: { email: string; password: string; orgId: string }) {
    const response = await request(app.getHttpServer()).post('/auth/login').send({
      email: input.email,
      password: input.password,
      orgId: input.orgId
    });

    expect(response.status).toBe(201);
    return response.body as { accessToken: string };
  }

  beforeAll(async () => {
    const modRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(IdentityBootstrapService)
      .useValue({
        onModuleInit: async () => undefined
      })
      .compile();

    app = modRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);
  });

  beforeEach(async () => {
    await clearTenantData();
    await ensureSystemRoles();
  });

  it('covers settings lifecycle, access/photo enforcement, and confirmation template behavior', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Section4 Org', code: 'section4' }
    });

    await createOrgUser({
      email: 'admin@section4.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@section4.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Section 4 Event',
        status: 'PUBLISHED'
      }
    });

    const secureLink = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'section4-secure-link',
        title: 'Section4 Secure Link',
        rule: {
          create: {
            visibility: 'PUBLIC',
            approvalMode: 'AUTO'
          }
        }
      }
    });

    const updateEventSettingsRes = await request(app.getHttpServer())
      .patch(`/org/${org.code}/events/${event.id}/settings`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        venue: 'Millennium Hall',
        eventLogoUrl: 'https://cdn.example.com/logo.png',
        eventBannerUrl: 'https://cdn.example.com/banner.png',
        registrationStartsAt: '2026-11-01T08:00:00.000Z',
        registrationEndsAt: '2026-11-10T18:00:00.000Z',
        checkinPolicy: 'APPROVED_ONLY'
      });

    expect(updateEventSettingsRes.status).toBe(200);
    expect(updateEventSettingsRes.body.venue).toBe('Millennium Hall');

    const getEventSettingsRes = await request(app.getHttpServer())
      .get(`/org/${org.code}/events/${event.id}/settings`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(getEventSettingsRes.status).toBe(200);
    expect(getEventSettingsRes.body.eventLogoUrl).toBe('https://cdn.example.com/logo.png');

    await prisma.communicationTemplate.create({
      data: {
        organizationId: org.id,
        name: 'section4-template',
        channel: 'EMAIL',
        subject: 'Section4 Subject',
        body: 'Hello {{fullName}}',
        isActive: true
      }
    });

    const updateLinkSettingsRes = await request(app.getHttpServer())
      .patch(`/org/${org.code}/events/${event.id}/links/${secureLink.id}/settings`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        confirmationMessage: 'Welcome to Section4.',
        emailTemplateName: 'section4-template',
        registrationInstructions: 'Arrive 30 minutes early and bring your QR code.',
        photoUpload: 'REQUIRED',
        accessMode: 'PASSWORD_PROTECTED',
        accessPassword: 'Secret123'
      });

    expect(updateLinkSettingsRes.status).toBe(200);
    expect(updateLinkSettingsRes.body.photoUpload).toBe('REQUIRED');
    expect(updateLinkSettingsRes.body.accessMode).toBe('PASSWORD_PROTECTED');

    const getLinkSettingsRes = await request(app.getHttpServer())
      .get(`/org/${org.code}/events/${event.id}/links/${secureLink.id}/settings`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(getLinkSettingsRes.status).toBe(200);
    expect(getLinkSettingsRes.body.confirmationMessage).toBe('Welcome to Section4.');
    expect(getLinkSettingsRes.body.emailTemplateName).toBe('section4-template');
    expect(getLinkSettingsRes.body.registrationInstructions).toContain('Arrive 30 minutes early');

    const resolveDenied = await request(app.getHttpServer()).get('/public/register/section4-secure-link');
    expect(resolveDenied.status).toBe(403);

    const resolveAllowed = await request(app.getHttpServer())
      .get('/public/register/section4-secure-link')
      .query({ accessPassword: 'Secret123' });
    expect(resolveAllowed.status).toBe(200);
    expect(resolveAllowed.body.event.description).toBeNull();
    expect(resolveAllowed.body.registrationInstructions).toContain('Arrive 30 minutes early');

    const schemaRes = await request(app.getHttpServer())
      .get('/public/register/section4-secure-link/schema')
      .query({ accessPassword: 'Secret123' });
    expect(schemaRes.status).toBe(200);
    expect(schemaRes.body.photoUpload).toBe('REQUIRED');
    expect(schemaRes.body.registrationInstructions).toContain('Arrive 30 minutes early');

    const requiredPhotoDenied = await request(app.getHttpServer())
      .post('/public/register/section4-secure-link/submissions')
      .send({
        fullName: 'No Photo User',
        email: 'nophoto@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        accessPassword: 'Secret123',
        responses: []
      });

    expect(requiredPhotoDenied.status).toBe(400);

    const withPhotoSubmit = await request(app.getHttpServer())
      .post('/public/register/section4-secure-link/submissions')
      .send({
        fullName: 'With Photo User',
        email: 'withphoto@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        accessPassword: 'Secret123',
        photoUrl: 'https://cdn.example.com/withphoto.jpg',
        responses: []
      });

    expect(withPhotoSubmit.status).toBe(201);
    expect(withPhotoSubmit.body.confirmationMessage).toBe('Welcome to Section4.');

    const withPhotoRegistrant = await prisma.registrant.findUnique({
      where: { referenceCode: withPhotoSubmit.body.referenceCode },
      select: { id: true }
    });

    expect(withPhotoRegistrant).not.toBeNull();

    const templateResolvedAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'REGISTRATION_SUBMIT',
        targetId: withPhotoRegistrant?.id || ''
      },
      orderBy: { createdAt: 'desc' }
    });

    const resolvedMetadata = (templateResolvedAudit?.metadataJson || {}) as Record<string, unknown>;
    expect(resolvedMetadata.confirmationTemplateResolved).toBe(true);
    expect(resolvedMetadata.confirmationTemplateName).toBe('section4-template');
    expect(resolvedMetadata.confirmationMessage).toBe('Welcome to Section4.');

    const fallbackLink = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'section4-fallback-link',
        title: 'Section4 Fallback Link',
        rule: {
          create: {
            visibility: 'PUBLIC',
            approvalMode: 'AUTO'
          }
        }
      }
    });

    const updateFallbackLinkSettingsRes = await request(app.getHttpServer())
      .patch(`/org/${org.code}/events/${event.id}/links/${fallbackLink.id}/settings`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        confirmationMessage: 'Fallback message.',
        emailTemplateName: 'missing-template',
        photoUpload: 'OPTIONAL',
        accessMode: 'PUBLIC'
      });

    expect(updateFallbackLinkSettingsRes.status).toBe(200);

    const fallbackSubmit = await request(app.getHttpServer())
      .post('/public/register/section4-fallback-link/submissions')
      .send({
        fullName: 'Fallback User',
        email: 'fallback@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: []
      });

    expect(fallbackSubmit.status).toBe(201);
    expect(fallbackSubmit.body.confirmationMessage).toBe('Fallback message.');

    const fallbackRegistrant = await prisma.registrant.findUnique({
      where: { referenceCode: fallbackSubmit.body.referenceCode },
      select: { id: true }
    });

    expect(fallbackRegistrant).not.toBeNull();

    const fallbackAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'REGISTRATION_SUBMIT',
        targetId: fallbackRegistrant?.id || ''
      },
      orderBy: { createdAt: 'desc' }
    });

    const fallbackMetadata = (fallbackAudit?.metadataJson || {}) as Record<string, unknown>;
    expect(fallbackMetadata.confirmationTemplateResolved).toBe(false);
    expect(fallbackMetadata.confirmationTemplateRequested).toBe('missing-template');
    expect(fallbackMetadata.confirmationTemplateName).toBe('default-registration-confirmation');
    expect(fallbackMetadata.confirmationMessage).toBe('Fallback message.');
  });
});
