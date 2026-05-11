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

describe.skipIf(!runIntegration)('Events integration (MySQL)', () => {
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

  it('supports event CRUD and link lifecycle for org admin', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Acme Org', code: 'acme' }
    });

    await createOrgUser({
      email: 'admin@acme.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@acme.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const createEventRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/events`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        name: 'Acme Summit',
        description: 'Annual summit'
      });

    expect(createEventRes.status).toBe(201);
    const eventId = createEventRes.body.id as string;

    const updateEventRes = await request(app.getHttpServer())
      .patch(`/org/${org.code}/events/${eventId}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        status: 'PUBLISHED'
      });

    expect(updateEventRes.status).toBe(200);
    expect(updateEventRes.body.status).toBe('PUBLISHED');

    const createLinkRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/events/${eventId}/links`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        title: 'VIP Registration',
        slug: 'vip-registration',
        visibility: 'UNLISTED',
        approvalMode: 'MANUAL',
        capacity: 100
      });

    expect(createLinkRes.status).toBe(201);

    const duplicateSlugRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/events/${eventId}/links`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        title: 'VIP Registration 2',
        slug: 'vip-registration'
      });

    expect(duplicateSlugRes.status).toBe(400);

    const linksListRes = await request(app.getHttpServer())
      .get(`/org/${org.code}/events/${eventId}/links`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(linksListRes.status).toBe(200);
    expect(Array.isArray(linksListRes.body)).toBe(true);
    expect(linksListRes.body.length).toBe(1);

    const linkId = linksListRes.body[0].id as string;
    const updateLinkRes = await request(app.getHttpServer())
      .patch(`/org/${org.code}/events/${eventId}/links/${linkId}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        title: 'VIP Registration Updated',
        visibility: 'PRIVATE',
        approvalMode: 'MANUAL',
        capacity: 80
      });

    expect(updateLinkRes.status).toBe(200);
    expect(updateLinkRes.body.title).toBe('VIP Registration Updated');
    expect(updateLinkRes.body.rule.visibility).toBe('PRIVATE');

    const deleteLinkRes = await request(app.getHttpServer())
      .delete(`/org/${org.code}/events/${eventId}/links/${linkId}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(deleteLinkRes.status).toBe(200);
    expect(deleteLinkRes.body.deleted).toBe(true);

    const linksAfterDeleteRes = await request(app.getHttpServer())
      .get(`/org/${org.code}/events/${eventId}/links`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(linksAfterDeleteRes.status).toBe(200);
    expect(Array.isArray(linksAfterDeleteRes.body)).toBe(true);
    expect(linksAfterDeleteRes.body).toHaveLength(0);

    const archiveRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/events/${eventId}/archive`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({});

    expect(archiveRes.status).toBe(201);
    expect(archiveRes.body.status).toBe('ARCHIVED');
  });

  it('blocks org staff from mutating event settings', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Rocket Org', code: 'rocket' }
    });

    await createOrgUser({
      email: 'staff@rocket.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_STAFF'
    });

    const auth = await loginOrgUser({
      email: 'staff@rocket.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const createEventRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/events`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        name: 'Staff Attempt Event'
      });

    expect(createEventRes.status).toBe(403);
  });

  it('resolves public link metadata with effective rules', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Delta Org', code: 'delta' }
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Delta Expo',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'expo-general',
        title: 'Expo General',
        rule: {
          create: {
            visibility: 'PUBLIC',
            approvalMode: 'AUTO'
          }
        }
      }
    });

    const metadataRes = await request(app.getHttpServer()).get(
      `/public/o/${org.code}/events/${event.id}/links/${link.slug}`
    );

    expect(metadataRes.status).toBe(200);
    expect(metadataRes.body.linkId).toBe(link.id);
    expect(metadataRes.body.effectiveRules.visibility).toBe('PUBLIC');
    expect(typeof metadataRes.body.effectiveRules.isOpen).toBe('boolean');

    const invalidSlugRes = await request(app.getHttpServer()).get(
      `/public/o/${org.code}/events/${event.id}/links/INVALID_SLUG!`
    );
    expect(invalidSlugRes.status).toBe(400);
  });

  it('validates conflicting capacities and date windows', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Orbit Org', code: 'orbit' }
    });

    await createOrgUser({
      email: 'admin@orbit.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@orbit.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const invalidEventWindowRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/events`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        name: 'Orbit Summit',
        startsAt: '2026-10-12T10:00:00.000Z',
        endsAt: '2026-10-11T10:00:00.000Z'
      });

    expect(invalidEventWindowRes.status).toBe(400);

    const createEventRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/events`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        name: 'Orbit Summit'
      });

    expect(createEventRes.status).toBe(201);
    const eventId = createEventRes.body.id as string;

    const invalidCapacityRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/events/${eventId}/links`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        title: 'General',
        slug: 'general',
        capacity: 0
      });

    expect(invalidCapacityRes.status).toBe(400);

    const invalidLinkWindowRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/events/${eventId}/links`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        title: 'VIP',
        slug: 'vip',
        opensAt: '2026-10-12T10:00:00.000Z',
        closesAt: '2026-10-11T10:00:00.000Z'
      });

    expect(invalidLinkWindowRes.status).toBe(400);
  });

  it('updates and lists registration link form fields in position order', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Builder Org', code: 'builder' }
    });

    await createOrgUser({
      email: 'admin@builder.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@builder.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Builder Event',
        status: 'DRAFT'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'builder-link',
        title: 'Builder Link'
      }
    });

    const updateFieldsRes = await request(app.getHttpServer())
      .patch(`/org/${org.code}/events/${event.id}/links/${link.id}/form-fields`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        fields: [
          {
            key: 'attendance_type',
            label: 'Attendance Type',
            type: 'SELECT',
            required: true,
            options: ['In Person', 'Online']
          },
          {
            key: 'company',
            label: 'Company',
            type: 'TEXT',
            required: false,
            minLength: 2,
            maxLength: 80
          }
        ]
      });

    expect(updateFieldsRes.status).toBe(200);
    expect(updateFieldsRes.body).toHaveLength(2);
    expect(updateFieldsRes.body[0].key).toBe('attendance_type');
    expect(updateFieldsRes.body[0].position).toBe(0);
    expect(updateFieldsRes.body[1].key).toBe('company');
    expect(updateFieldsRes.body[1].position).toBe(1);

    const listFieldsRes = await request(app.getHttpServer())
      .get(`/org/${org.code}/events/${event.id}/links/${link.id}/form-fields`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(listFieldsRes.status).toBe(200);
    expect(listFieldsRes.body).toHaveLength(2);
    expect(listFieldsRes.body[0].key).toBe('attendance_type');
    expect(listFieldsRes.body[1].key).toBe('company');

    const replaceFieldsRes = await request(app.getHttpServer())
      .patch(`/org/${org.code}/events/${event.id}/links/${link.id}/form-fields`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        fields: [
          {
            key: 'company',
            label: 'Company',
            type: 'TEXT',
            required: true,
            minLength: 2,
            maxLength: 120
          }
        ]
      });

    expect(replaceFieldsRes.status).toBe(200);
    expect(replaceFieldsRes.body).toHaveLength(1);
    expect(replaceFieldsRes.body[0].key).toBe('company');
    expect(replaceFieldsRes.body[0].position).toBe(0);
  });

  it('enforces permission and payload validation for registration link form fields', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Rules Org', code: 'rules' }
    });

    await createOrgUser({
      email: 'admin@rules.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });
    await createOrgUser({
      email: 'staff@rules.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_STAFF'
    });

    const adminAuth = await loginOrgUser({
      email: 'admin@rules.com',
      password: 'StrongPass123!',
      orgId: org.id
    });
    const staffAuth = await loginOrgUser({
      email: 'staff@rules.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Rules Event',
        status: 'DRAFT'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'rules-link',
        title: 'Rules Link'
      }
    });

    const duplicateKeyRes = await request(app.getHttpServer())
      .patch(`/org/${org.code}/events/${event.id}/links/${link.id}/form-fields`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        fields: [
          {
            key: 'team',
            label: 'Team',
            type: 'TEXT',
            required: false
          },
          {
            key: 'team',
            label: 'Team 2',
            type: 'TEXT',
            required: false
          }
        ]
      });

    expect(duplicateKeyRes.status).toBe(400);

    const missingOptionsRes = await request(app.getHttpServer())
      .patch(`/org/${org.code}/events/${event.id}/links/${link.id}/form-fields`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        fields: [
          {
            key: 'attendance_mode',
            label: 'Attendance Mode',
            type: 'SELECT',
            required: true,
            options: []
          }
        ]
      });

    expect(missingOptionsRes.status).toBe(400);

    const staffDeniedRes = await request(app.getHttpServer())
      .patch(`/org/${org.code}/events/${event.id}/links/${link.id}/form-fields`)
      .set('Authorization', `Bearer ${staffAuth.accessToken}`)
      .send({
        fields: [
          {
            key: 'nickname',
            label: 'Nickname',
            type: 'TEXT',
            required: false
          }
        ]
      });

    expect(staffDeniedRes.status).toBe(403);
  });

  it('supports event template create, list, apply, and delete', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Template Org', code: 'templateorg' }
    });

    await createOrgUser({
      email: 'admin@templateorg.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@templateorg.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const createTemplateRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/event-templates`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        name: 'Conference Template',
        eventName: 'Annual Conference',
        description: 'Template description'
      });

    expect(createTemplateRes.status).toBe(201);
    expect(createTemplateRes.body.id).toBeTruthy();

    const listTemplatesRes = await request(app.getHttpServer())
      .get(`/org/${org.code}/event-templates`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(listTemplatesRes.status).toBe(200);
    expect(Array.isArray(listTemplatesRes.body)).toBe(true);
    expect(listTemplatesRes.body).toHaveLength(1);

    const templateId = listTemplatesRes.body[0].id as string;
    const applyTemplateRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/event-templates/${templateId}/apply`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        name: 'Conference 2026'
      });

    expect(applyTemplateRes.status).toBe(201);
    expect(applyTemplateRes.body.name).toBe('Conference 2026');

    const deleteTemplateRes = await request(app.getHttpServer())
      .delete(`/org/${org.code}/event-templates/${templateId}`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(deleteTemplateRes.status).toBe(200);
    expect(deleteTemplateRes.body.deleted).toBe(true);
  });

  it('supports link approval rule configuration lifecycle', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Approval Org', code: 'approvalorg' }
    });

    await createOrgUser({
      email: 'admin@approvalorg.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@approvalorg.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Approval Event',
        status: 'DRAFT'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'approval-link',
        title: 'Approval Link'
      }
    });

    const updateRulesRes = await request(app.getHttpServer())
      .patch(`/org/${org.code}/events/${event.id}/links/${link.id}/approval-rules`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        rules: [
          {
            name: 'Approve seniors',
            fieldKey: 'age',
            operator: 'GTE',
            value: '30',
            action: 'APPROVE',
            order: 0
          },
          {
            name: 'Reject invalid country',
            fieldKey: 'country',
            operator: 'EQ',
            value: 'XX',
            action: 'REJECT',
            order: 1
          }
        ]
      });

    expect(updateRulesRes.status).toBe(200);
    expect(updateRulesRes.body).toHaveLength(2);

    const listRulesRes = await request(app.getHttpServer())
      .get(`/org/${org.code}/events/${event.id}/links/${link.id}/approval-rules`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(listRulesRes.status).toBe(200);
    expect(listRulesRes.body).toHaveLength(2);
    expect(listRulesRes.body[0].fieldKey).toBe('age');
  });

  it('supports event and link settings lifecycle for section 4 structure fields', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Structure Org', code: 'structureorg' }
    });

    await createOrgUser({
      email: 'admin@structureorg.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@structureorg.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Structure Event',
        status: 'DRAFT'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'structure-link',
        title: 'Structure Link'
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
    expect(updateEventSettingsRes.body.checkinPolicy).toBe('APPROVED_ONLY');

    const getEventSettingsRes = await request(app.getHttpServer())
      .get(`/org/${org.code}/events/${event.id}/settings`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(getEventSettingsRes.status).toBe(200);
    expect(getEventSettingsRes.body.eventLogoUrl).toBe('https://cdn.example.com/logo.png');

    const missingPasswordRes = await request(app.getHttpServer())
      .patch(`/org/${org.code}/events/${event.id}/links/${link.id}/settings`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        accessMode: 'PASSWORD_PROTECTED'
      });

    expect(missingPasswordRes.status).toBe(400);

    const updateLinkSettingsRes = await request(app.getHttpServer())
      .patch(`/org/${org.code}/events/${event.id}/links/${link.id}/settings`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        confirmationMessage: 'Thanks for registering. Please bring your ID.',
        emailTemplateName: 'vip-confirmation-v2',
        photoUpload: 'REQUIRED',
        accessMode: 'PASSWORD_PROTECTED',
        accessPassword: 'Secret123',
        pageTemplate: 'CONFERENCE',
        pageLogoUrl: 'https://cdn.example.com/page-logo.png',
        pageBannerImageUrl: 'https://cdn.example.com/page-banner.png',
        pageBackgroundColor: '#102033',
        pageButtonColor: '#F4C95D',
        pageFontFamily: 'Georgia, serif',
        pageEventDescription: 'A premium registration experience for conference guests.',
        sponsorLogoUrls: ['https://cdn.example.com/sponsor-a.png', 'https://cdn.example.com/sponsor-b.png'],
        formLayout: 'TWO_COLUMN',
        footerText: 'Need help? Contact events@example.com',
        privacyNotice: 'Your information is processed for event operations only.',
        termsAndConditions: 'By registering, you agree to the event code of conduct.'
      });

    expect(updateLinkSettingsRes.status).toBe(200);
    expect(updateLinkSettingsRes.body.photoUpload).toBe('REQUIRED');
    expect(updateLinkSettingsRes.body.accessMode).toBe('PASSWORD_PROTECTED');

    const getLinkSettingsRes = await request(app.getHttpServer())
      .get(`/org/${org.code}/events/${event.id}/links/${link.id}/settings`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(getLinkSettingsRes.status).toBe(200);
    expect(getLinkSettingsRes.body.confirmationMessage).toContain('bring your ID');
    expect(getLinkSettingsRes.body.emailTemplateName).toBe('vip-confirmation-v2');
    expect(getLinkSettingsRes.body.pageTemplate).toBe('CONFERENCE');
    expect(getLinkSettingsRes.body.pageLogoUrl).toBe('https://cdn.example.com/page-logo.png');
    expect(getLinkSettingsRes.body.pageBackgroundColor).toBe('#102033');
    expect(getLinkSettingsRes.body.sponsorLogoUrls).toEqual([
      'https://cdn.example.com/sponsor-a.png',
      'https://cdn.example.com/sponsor-b.png'
    ]);
    expect(getLinkSettingsRes.body.formLayout).toBe('TWO_COLUMN');
  });
});
