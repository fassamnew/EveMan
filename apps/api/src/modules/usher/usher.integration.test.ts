import 'reflect-metadata';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../infra/db/prisma.service';
import { PasswordService } from '../common/password.service';
import { BadgeQrService } from '../badges/badge-qr.service';
import { IdentityBootstrapService } from '../organizations/identity-bootstrap.service';

const runIntegration = Boolean(process.env.DATABASE_URL);

const SYSTEM_ROLES: Array<{ name: RoleName; description: string }> = [
  { name: 'SUPER_ADMIN', description: 'Platform super administrator' },
  { name: 'ORG_ADMIN', description: 'Organization administrator' },
  { name: 'ORG_STAFF', description: 'Organization staff member' }
];

describe.skipIf(!runIntegration)('Usher integration (MySQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let badgeQrService: BadgeQrService;

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
    await prisma.checkin.deleteMany();
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
    badgeQrService = app.get(BadgeQrService);
  });

  beforeEach(async () => {
    await clearTenantData();
    await ensureSystemRoles();
  });

  it('returns usher assignments and handles accepted, duplicate, and idempotent checkins', async () => {
    const org = await prisma.organization.create({ data: { name: 'Usher Org', code: 'usherorg' } });

    await createOrgUser({
      email: 'usher@usherorg.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_STAFF'
    });

    const auth = await loginOrgUser({
      email: 'usher@usherorg.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Door Ops Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'door-ops',
        title: 'Door Ops Registration'
      }
    });

    const registrant = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'USHR0001',
        email: 'scan@usher.org',
        fullName: 'Scan Target',
        lifecycleStatus: 'APPROVED',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    const issued = await badgeQrService.issueForRegistrant({ registrantId: registrant.id });

    const assignmentsRes = await request(app.getHttpServer())
      .get('/usher/assignments')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(assignmentsRes.status).toBe(200);
    expect((assignmentsRes.body as { events: Array<{ id: string }> }).events.length).toBe(1);

    const acceptedRes = await request(app.getHttpServer())
      .post('/usher/checkins')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        token: issued.qrToken,
        idempotencyKey: 'scan-001',
        deviceId: 'device-a',
        source: 'MOBILE_ONLINE'
      });

    expect(acceptedRes.status).toBe(201);
    expect(acceptedRes.body.status).toBe('ACCEPTED');

    const replayRes = await request(app.getHttpServer())
      .post('/usher/checkins')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        token: issued.qrToken,
        idempotencyKey: 'scan-001',
        deviceId: 'device-a',
        source: 'MOBILE_ONLINE'
      });

    expect(replayRes.status).toBe(201);
    expect(replayRes.body.status).toBe('IDEMPOTENT_REPLAY');

    const duplicateRes = await request(app.getHttpServer())
      .post('/usher/checkins')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        token: issued.qrToken,
        idempotencyKey: 'scan-002',
        deviceId: 'device-b',
        source: 'OFFLINE_SYNC'
      });

    expect(duplicateRes.status).toBe(201);
    expect(duplicateRes.body.status).toBe('DUPLICATE');
  });

  it('rejects invalid tokens on checkin attempts', async () => {
    const org = await prisma.organization.create({ data: { name: 'Bad Token Org', code: 'badtokenorg' } });

    await createOrgUser({
      email: 'usher@badtoken.org',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_STAFF'
    });

    const auth = await loginOrgUser({
      email: 'usher@badtoken.org',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const response = await request(app.getHttpServer())
      .post('/usher/checkins')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        token: 'invalid.token.value',
        idempotencyKey: 'bad-001',
        deviceId: 'device-z'
      });

    expect(response.status).toBe(400);
  });

  it('returns WRONG_EVENT and NOT_APPROVED statuses when applicable', async () => {
    const org = await prisma.organization.create({ data: { name: 'State Org', code: 'stateorg' } });

    await createOrgUser({
      email: 'usher@state.org',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_STAFF'
    });

    const auth = await loginOrgUser({
      email: 'usher@state.org',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const eventA = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'State Event A',
        status: 'PUBLISHED'
      }
    });

    const eventB = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'State Event B',
        status: 'PUBLISHED'
      }
    });

    const linkA = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: eventA.id,
        slug: 'state-a',
        title: 'State A Link'
      }
    });

    const pendingRegistrant = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: eventA.id,
        registrationLinkId: linkA.id,
        referenceCode: 'STATE001',
        email: 'pending@state.org',
        fullName: 'Pending State',
        lifecycleStatus: 'PENDING',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    const issued = await badgeQrService.issueForRegistrant({ registrantId: pendingRegistrant.id });

    const wrongEventRes = await request(app.getHttpServer())
      .post('/usher/checkins')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        token: issued.qrToken,
        selectedEventId: eventB.id,
        idempotencyKey: 'state-001',
        deviceId: 'device-s1',
        source: 'MOBILE_ONLINE'
      });

    expect(wrongEventRes.status).toBe(201);
    expect(wrongEventRes.body.status).toBe('WRONG_EVENT');

    const notApprovedRes = await request(app.getHttpServer())
      .post('/usher/checkins')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        token: issued.qrToken,
        selectedEventId: eventA.id,
        idempotencyKey: 'state-002',
        deviceId: 'device-s2',
        source: 'MOBILE_ONLINE'
      });

    expect(notApprovedRes.status).toBe(201);
    expect(notApprovedRes.body.status).toBe('NOT_APPROVED');
  });

  it('supports manual attendee search by name, email, phone, and reference', async () => {
    const org = await prisma.organization.create({ data: { name: 'Search Org', code: 'searchorg' } });

    await createOrgUser({
      email: 'usher@search.org',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_STAFF'
    });

    const auth = await loginOrgUser({
      email: 'usher@search.org',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Search Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'search-event',
        title: 'Search Category'
      }
    });

    const registrant = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'SEARCH001',
        email: 'search.person@org.com',
        fullName: 'Search Person',
        lifecycleStatus: 'APPROVED',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    await prisma.registrantResponse.createMany({
      data: [
        {
          registrantId: registrant.id,
          fieldKey: 'phone',
          valueText: '+251933333333'
        },
        {
          registrantId: registrant.id,
          fieldKey: '__photo_upload__',
          valueText: 'https://cdn.example.com/p.jpg'
        }
      ]
    });

    const byNameRes = await request(app.getHttpServer())
      .get('/usher/search')
      .query({ q: 'Search Person', eventId: event.id })
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(byNameRes.status).toBe(200);
    expect(byNameRes.body.items).toHaveLength(1);
    expect(byNameRes.body.items[0].referenceCode).toBe('SEARCH001');

    const byPhoneRes = await request(app.getHttpServer())
      .get('/usher/search')
      .query({ q: '+251933333333', eventId: event.id })
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(byPhoneRes.status).toBe(200);
    expect(byPhoneRes.body.items).toHaveLength(1);
    expect(byPhoneRes.body.items[0].photoUrl).toBe('https://cdn.example.com/p.jpg');
  });

  it('returns ACCESS_DENIED when access zone does not match attendee zone', async () => {
    const org = await prisma.organization.create({ data: { name: 'Zone Org', code: 'zoneorg' } });

    await createOrgUser({
      email: 'usher@zone.org',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_STAFF'
    });

    const auth = await loginOrgUser({
      email: 'usher@zone.org',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Zone Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'zone-event',
        title: 'VIP'
      }
    });

    const registrant = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'ZONE001',
        email: 'zone.person@org.com',
        fullName: 'Zone Person',
        lifecycleStatus: 'APPROVED',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    await prisma.registrantResponse.create({
      data: {
        registrantId: registrant.id,
        fieldKey: 'accessZone',
        valueText: 'VIP'
      }
    });

    const issued = await badgeQrService.issueForRegistrant({ registrantId: registrant.id });

    const deniedRes = await request(app.getHttpServer())
      .post('/usher/checkins')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        token: issued.qrToken,
        selectedEventId: event.id,
        accessZone: 'General',
        idempotencyKey: 'zone-001',
        deviceId: 'device-z1',
        source: 'MOBILE_ONLINE'
      });

    expect(deniedRes.status).toBe(201);
    expect(deniedRes.body.status).toBe('ACCESS_DENIED');
    expect(deniedRes.body.reason).toBe('ZONE_RESTRICTED');
  });
});
