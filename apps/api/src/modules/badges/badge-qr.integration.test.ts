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
import { BadgeQrService } from './badge-qr.service';

const runIntegration = Boolean(process.env.DATABASE_URL);
const SYSTEM_ROLES: Array<{ name: RoleName; description: string }> = [
  { name: 'SUPER_ADMIN', description: 'Platform super administrator' },
  { name: 'ORG_ADMIN', description: 'Organization administrator' },
  { name: 'ORG_STAFF', description: 'Organization staff member' }
];

describe.skipIf(!runIntegration)('Badge QR integration (MySQL)', () => {
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

  async function waitForBadgeReady(badgeId: string): Promise<{ status: string; storagePath: string | null }> {
    for (let i = 0; i < 25; i += 1) {
      const badge = await prisma.badge.findUnique({
        where: { id: badgeId },
        select: {
          status: true,
          storagePath: true
        }
      });

      if (!badge) {
        throw new Error('Badge missing while waiting for render completion');
      }

      if (badge.status === 'READY' || badge.status === 'FAILED') {
        return badge;
      }

      await new Promise(resolve => setTimeout(resolve, 80));
    }

    throw new Error('Timed out waiting for badge render completion');
  }

  it('assigns templates, issues qr-backed badge, and verifies qr token', async () => {
    const org = await prisma.organization.create({ data: { name: 'Acme', code: 'acme' } });

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

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Acme Conf',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'acme-conf-2026',
        title: 'Acme Conf Registration',
        rule: {
          create: {
            visibility: 'PUBLIC',
            approvalMode: 'AUTO'
          }
        }
      }
    });

    const template = await prisma.badgeTemplate.create({
      data: {
        organizationId: org.id,
        name: 'Standard',
        version: 1,
        configJson: {
          layout: 'v1'
        }
      }
    });

    const assignRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/templates/badges/${template.id}/assign/${link.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({});

    expect(assignRes.status).toBe(201);

    const registrant = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'ABCDEF12',
        email: 'person@acme.com',
        fullName: 'Acme Person',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    const issued = await badgeQrService.issueForRegistrant({ registrantId: registrant.id });
    expect(issued.status).toBe('PENDING');
    expect(typeof issued.qrToken).toBe('string');

    const readyBadge = await waitForBadgeReady(issued.badgeId);
    expect(readyBadge.status).toBe('READY');
    expect(typeof readyBadge.storagePath).toBe('string');

    const verifyRes = await request(app.getHttpServer())
      .post('/verify/qr')
      .send({ token: issued.qrToken });

    expect(verifyRes.status).toBe(201);
    expect(verifyRes.body.status).toBe('VALID');
    expect(verifyRes.body.registrant.name).toBe('Acme Person');

    const tamperedRes = await request(app.getHttpServer())
      .post('/verify/qr')
      .send({ token: `${issued.qrToken}tamper` });

    expect(tamperedRes.status).toBe(400);
  });

  it('rejects revoked qr tokens', async () => {
    const org = await prisma.organization.create({ data: { name: 'Nova', code: 'nova' } });
    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Nova Expo',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'nova-expo',
        title: 'Nova Expo Reg'
      }
    });

    await prisma.badgeTemplate.create({
      data: {
        organizationId: org.id,
        name: 'Basic',
        version: 1,
        configJson: { layout: 'simple' }
      }
    });

    const registrant = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'ZXCV1234',
        email: 'nova@example.com',
        fullName: 'Nova User',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    const issued = await badgeQrService.issueForRegistrant({ registrantId: registrant.id });
    const qr = await prisma.qrCode.findFirst({ where: { registrantId: registrant.id } });
    expect(qr).toBeTruthy();

    await prisma.qrCode.update({
      where: { id: qr!.id },
      data: { status: 'REVOKED' }
    });

    const verifyRes = await request(app.getHttpServer())
      .post('/verify/qr')
      .send({ token: issued.qrToken });

    expect(verifyRes.status).toBe(400);
    const reason =
      (verifyRes.body as { reason?: string }).reason ||
      (verifyRes.body as { message?: { reason?: string } }).message?.reason;
    expect(reason).toBe('TOKEN_REVOKED');
  });

  it('queues regeneration and renders badge again', async () => {
    const org = await prisma.organization.create({ data: { name: 'Regens', code: 'regens' } });

    await createOrgUser({
      email: 'admin@regens.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@regens.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Regens Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'regens-2026',
        title: 'Regens Registration'
      }
    });

    const registrant = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'REGEN123',
        email: 'regen@example.com',
        fullName: 'Re Gen',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    const issued = await badgeQrService.issueForRegistrant({ registrantId: registrant.id });
    await waitForBadgeReady(issued.badgeId);

    const regenRes = await request(app.getHttpServer())
      .patch(`/org/${org.code}/registrants/${registrant.id}/badge/regenerate`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({});

    expect(regenRes.status).toBe(200);
    expect(regenRes.body.status).toBe('PENDING');

    const readyAgain = await waitForBadgeReady(regenRes.body.badgeId as string);
    expect(readyAgain.status).toBe('READY');
  });
});
