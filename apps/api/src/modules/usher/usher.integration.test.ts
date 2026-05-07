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
});
