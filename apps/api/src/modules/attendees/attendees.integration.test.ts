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

describe.skipIf(!runIntegration)('Attendees integration (MySQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  async function ensureSystemRoles(): Promise<void> {
    for (const role of SYSTEM_ROLES) {
      await prisma.role.upsert({
        where: { name: role.name },
        update: {
          description: role.description,
          isSystem: true
        },
        create: {
          name: role.name,
          description: role.description,
          isSystem: true
        }
      });
    }
  }

  async function clearTenantData(): Promise<void> {
    await prisma.importError.deleteMany();
    await prisma.importJob.deleteMany();
    await prisma.communicationLog.deleteMany();
    await prisma.communicationTemplate.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.badge.deleteMany();
    await prisma.qrCode.deleteMany();
    await prisma.badgeTemplate.deleteMany();
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
    const role = await prisma.role.findUnique({ where: { name } });
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

  async function waitForBadgeReady(badgeId: string): Promise<void> {
    for (let i = 0; i < 40; i += 1) {
      const badge = await prisma.badge.findUnique({
        where: { id: badgeId },
        select: {
          status: true
        }
      });

      if (badge?.status === 'READY' || badge?.status === 'FAILED') {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('Timed out waiting for badge render completion');
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

  it('lists attendees with filters and paging', async () => {
    const org = await prisma.organization.create({ data: { name: 'Ops Org', code: 'opsorg' } });

    await createOrgUser({
      email: 'admin@opsorg.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@opsorg.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Ops Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'ops-event',
        title: 'Ops Event Registration'
      }
    });

    await prisma.registrant.createMany({
      data: [
        {
          organizationId: org.id,
          eventId: event.id,
          registrationLinkId: link.id,
          referenceCode: 'OPS001AA',
          email: 'a@ops.com',
          fullName: 'Alice Ops',
          lifecycleStatus: 'APPROVED',
          consentAccepted: true,
          consentPolicyVersion: 'v1',
          consentCapturedAt: new Date()
        },
        {
          organizationId: org.id,
          eventId: event.id,
          registrationLinkId: link.id,
          referenceCode: 'OPS002BB',
          email: 'b@ops.com',
          fullName: 'Bob Ops',
          lifecycleStatus: 'REJECTED',
          consentAccepted: true,
          consentPolicyVersion: 'v1',
          consentCapturedAt: new Date()
        }
      ]
    });

    const listRes = await request(app.getHttpServer())
      .get(`/org/${org.code}/attendees`)
      .query({ status: 'APPROVED', page: 1, pageSize: 1 })
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(listRes.status).toBe(200);
    expect((listRes.body as { items: Array<{ lifecycleStatus: string }> }).items.length).toBe(1);
    expect((listRes.body as { items: Array<{ lifecycleStatus: string }> }).items[0].lifecycleStatus).toBe('APPROVED');
    expect((listRes.body as { pagination: { total: number } }).pagination.total).toBe(1);
  });

  it('applies attendee lifecycle actions, edit, and resend badge', async () => {
    const org = await prisma.organization.create({ data: { name: 'Life Org', code: 'lifeorg' } });

    await createOrgUser({
      email: 'admin@lifeorg.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@lifeorg.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Lifecycle Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'lifecycle-event',
        title: 'Lifecycle Registration'
      }
    });

    const registrant = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'LIFE0001',
        email: 'person@life.com',
        fullName: 'Life Person',
        lifecycleStatus: 'PENDING',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    const badgeTemplate = await prisma.badgeTemplate.create({
      data: {
        organizationId: org.id,
        name: 'LifeTemplate',
        version: 1,
        configJson: { layout: 'simple' }
      }
    });

    await prisma.registrationLink.update({
      where: { id: link.id },
      data: {
        badgeTemplateId: badgeTemplate.id
      }
    });

    const rejectRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/attendees/${registrant.id}/reject`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({});

    expect(rejectRes.status).toBe(201);
    expect(rejectRes.body.lifecycleStatus).toBe('REJECTED');

    const approveRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/attendees/${registrant.id}/approve`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({});

    expect(approveRes.status).toBe(201);
    expect(approveRes.body.lifecycleStatus).toBe('APPROVED');

    const editRes = await request(app.getHttpServer())
      .patch(`/org/${org.code}/attendees/${registrant.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        fullName: 'Updated Life Person',
        email: 'updated@life.com'
      });

    expect(editRes.status).toBe(200);
    expect(editRes.body.fullName).toBe('Updated Life Person');
    expect(editRes.body.email).toBe('updated@life.com');

    const resendRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/attendees/${registrant.id}/resend-badge`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({});

    expect(resendRes.status).toBe(201);
    expect(resendRes.body.status).toBe('QUEUED');

    await waitForBadgeReady(resendRes.body.badgeId as string);

    const rendered = await prisma.badge.findUnique({
      where: { id: resendRes.body.badgeId as string },
      select: {
        status: true
      }
    });

    expect(rendered?.status).toBe('READY');
  });

  it('allows ORG_STAFF to manage attendee lifecycle actions', async () => {
    const org = await prisma.organization.create({ data: { name: 'Staff Org', code: 'stafforg' } });

    await createOrgUser({
      email: 'staff@stafforg.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_STAFF'
    });

    const auth = await loginOrgUser({
      email: 'staff@stafforg.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Staff Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'staff-event',
        title: 'Staff Registration'
      }
    });

    const registrant = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'STAFF001',
        email: 'person@staff.com',
        fullName: 'Staff Person',
        lifecycleStatus: 'PENDING',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    const approveRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/attendees/${registrant.id}/approve`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({});

    expect(approveRes.status).toBe(201);
    expect(approveRes.body.lifecycleStatus).toBe('APPROVED');
  });
});
