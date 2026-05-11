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
    expect(approveRes.body.badgeQueued).toBe(true);

    let approvedBadgeId: string | null = null;
    for (let i = 0; i < 40; i += 1) {
      const approvedBadge = await prisma.badge.findFirst({
        where: { registrantId: registrant.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true }
      });

      if (approvedBadge?.id) {
        approvedBadgeId = approvedBadge.id;
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    expect(approvedBadgeId).toBeTruthy();

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

  it('returns attendee communication history with filters', async () => {
    const org = await prisma.organization.create({ data: { name: 'Comms Org', code: 'commsorg' } });

    await createOrgUser({
      email: 'admin@commsorg.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@commsorg.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Comms Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'comms-event',
        title: 'Comms Registration'
      }
    });

    const registrant = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'COMMS001',
        email: 'person@comms.com',
        fullName: 'Comms Person',
        lifecycleStatus: 'APPROVED',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    await prisma.communicationLog.createMany({
      data: [
        {
          organizationId: org.id,
          registrantId: registrant.id,
          channel: 'EMAIL',
          status: 'SENT',
          recipientAddress: registrant.email
        },
        {
          organizationId: org.id,
          registrantId: registrant.id,
          channel: 'EMAIL',
          status: 'FAILED',
          recipientAddress: registrant.email,
          errorMessage: 'smtp issue'
        }
      ]
    });

    const response = await request(app.getHttpServer())
      .get(`/org/${org.code}/attendees/${registrant.id}/communications`)
      .query({ status: 'FAILED', page: 1, pageSize: 10 })
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.attendee.id).toBe(registrant.id);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].status).toBe('FAILED');
    expect(response.body.pagination.total).toBe(1);
  });

  it('allows manual check-in and prevents duplicate check-ins', async () => {
    const org = await prisma.organization.create({ data: { name: 'Check Org', code: 'checkorg' } });

    await createOrgUser({
      email: 'admin@checkorg.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@checkorg.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Check Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'check-event',
        title: 'Check Registration'
      }
    });

    const registrant = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'CHECK001',
        email: 'check@person.com',
        fullName: 'Check Person',
        lifecycleStatus: 'APPROVED',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    const checkInRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/attendees/${registrant.id}/check-in`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({});

    expect(checkInRes.status).toBe(201);
    expect(checkInRes.body.checkinId).toBeDefined();
    expect(checkInRes.body.checkedInAt).toBeDefined();

    // Verify check-in was recorded
    const checkin = await prisma.checkin.findUnique({
      where: {
        eventId_registrantId: {
          eventId: event.id,
          registrantId: registrant.id
        }
      }
    });

    expect(checkin).toBeDefined();
    expect(checkin?.source).toBe('MANUAL');

    // Try to check in again - should fail
    const duplicateRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/attendees/${registrant.id}/check-in`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({});

    expect(duplicateRes.status).toBe(400);
    expect(duplicateRes.body.message).toContain('already checked in');
  });

  it('allows canceling registrations and prevents cancel after check-in', async () => {
    const org = await prisma.organization.create({ data: { name: 'Cancel Org', code: 'cancelorg' } });

    await createOrgUser({
      email: 'admin@cancelorg.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@cancelorg.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Cancel Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'cancel-event',
        title: 'Cancel Registration'
      }
    });

    const registrant1 = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'CANCEL001',
        email: 'cancel1@person.com',
        fullName: 'Cancel Person 1',
        lifecycleStatus: 'APPROVED',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    // Cancel registration that hasn't been checked in
    const cancelRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/attendees/${registrant1.id}/cancel`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({});

    expect(cancelRes.status).toBe(201);
    expect(cancelRes.body.lifecycleStatus).toBe('REJECTED');

    // Verify status was updated
    const updated = await prisma.registrant.findUnique({
      where: { id: registrant1.id },
      select: { lifecycleStatus: true }
    });

    expect(updated?.lifecycleStatus).toBe('REJECTED');

    // Create another registrant, check them in, then try to cancel
    const registrant2 = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'CANCEL002',
        email: 'cancel2@person.com',
        fullName: 'Cancel Person 2',
        lifecycleStatus: 'APPROVED',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    // Check in first
    await request(app.getHttpServer())
      .post(`/org/${org.code}/attendees/${registrant2.id}/check-in`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({});

    // Try to cancel after check-in - should fail
    const cancelAfterCheckInRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/attendees/${registrant2.id}/cancel`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({});

    expect(cancelAfterCheckInRes.status).toBe(400);
    expect(cancelAfterCheckInRes.body.message).toContain('already checked-in');
  });

  it('updates attendee with custom response fields', async () => {
    const org = await prisma.organization.create({ data: { name: 'Response Org', code: 'resporg' } });

    await createOrgUser({
      email: 'admin@resporg.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@resporg.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Response Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'response-event',
        title: 'Response Registration'
      }
    });

    const registrant = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'RESP001',
        email: 'resp@person.com',
        fullName: 'Response Person',
        lifecycleStatus: 'APPROVED',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    const updateRes = await request(app.getHttpServer())
      .patch(`/org/${org.code}/attendees/${registrant.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        fullName: 'Updated Response Person',
        email: 'updated.resp@person.com',
        responses: [
          { fieldKey: 'phone', value: '+251911111111' },
          { fieldKey: 'organization', value: 'Test Corp' },
          { fieldKey: 'designation', value: 'Manager' }
        ]
      });

    expect(updateRes.status).toBe(200);

    // Verify responses were saved
    const responses = await prisma.registrantResponse.findMany({
      where: { registrantId: registrant.id }
    });

    expect(responses).toHaveLength(3);
    expect(responses.find(r => r.fieldKey === 'phone')?.valueText).toBe('+251911111111');
    expect(responses.find(r => r.fieldKey === 'organization')?.valueText).toBe('Test Corp');
    expect(responses.find(r => r.fieldKey === 'designation')?.valueText).toBe('Manager');
  });
});
