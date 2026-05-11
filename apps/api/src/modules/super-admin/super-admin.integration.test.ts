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

describe.skipIf(!runIntegration)('Super Admin integration (MySQL)', () => {
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
    await prisma.migrationMetadata.deleteMany({
      where: {
        key: {
          startsWith: 'super-admin:'
        }
      }
    });
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

  async function createUser(input: {
    email: string;
    password: string;
    roleName: RoleName;
    organizationId?: string | null;
    firstName?: string;
    lastName?: string;
  }): Promise<{ id: string }> {
    const roleId = await getRoleId(input.roleName);
    const hash = await passwordService.hash(input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: hash,
        firstName: input.firstName,
        lastName: input.lastName,
        isActive: true
      }
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId,
        organizationId: input.organizationId ?? null
      }
    });

    return { id: user.id };
  }

  async function loginSuperAdmin(input: { email: string; password: string }) {
    const response = await request(app.getHttpServer()).post('/auth/login').send({
      email: input.email,
      password: input.password
    });

    expect(response.status).toBe(201);
    return response.body as { accessToken: string };
  }

  beforeAll(async () => {
    const modRef = await Test.createTestingModule({ imports: [AppModule] })
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

  it('exposes platform overview, all events, and audit visibility to super admin', async () => {
    const superAdmin = await createUser({
      email: 'super@platform.test',
      password: 'StrongPass123!',
      roleName: 'SUPER_ADMIN'
    });

    const org = await prisma.organization.create({
      data: { name: 'Launch Org', code: 'launch-org' }
    });

    await createUser({
      email: 'admin@launch.test',
      password: 'StrongPass123!',
      roleName: 'ORG_ADMIN',
      organizationId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Platform Launch',
        status: 'PUBLISHED'
      }
    });

    const auth = await loginSuperAdmin({
      email: 'super@platform.test',
      password: 'StrongPass123!'
    });

    const overviewRes = await request(app.getHttpServer())
      .get('/super-admin/platform/overview')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.organizations).toBe(1);
    expect(overviewRes.body.events).toBe(1);
    expect(overviewRes.body.users).toBe(2);

    const eventsRes = await request(app.getHttpServer())
      .get('/super-admin/platform/events')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(eventsRes.status).toBe(200);
    expect(eventsRes.body).toHaveLength(1);
    expect(eventsRes.body[0].id).toBe(event.id);
    expect(eventsRes.body[0].organization.code).toBe(org.code);

    const usersRes = await request(app.getHttpServer())
      .get('/super-admin/system/users')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(usersRes.status).toBe(200);
    expect(usersRes.body).toHaveLength(2);

    const updateOrgRes = await request(app.getHttpServer())
      .patch(`/super-admin/organizations/${org.code}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        name: 'Launch Org Updated',
        isActive: false
      });

    expect(updateOrgRes.status).toBe(200);
    expect(updateOrgRes.body.name).toBe('Launch Org Updated');
    expect(updateOrgRes.body.isActive).toBe(false);

    const auditRes = await request(app.getHttpServer())
      .get('/super-admin/system/audit-logs?limit=20')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(auditRes.status).toBe(200);
    expect(Array.isArray(auditRes.body)).toBe(true);
    expect(auditRes.body.some((item: { action: string; actorUser: { id: string } | null }) => item.action === 'ORG_UPDATE' && item.actorUser?.id === superAdmin.id)).toBe(true);
  });

  it('persists section 3.1 settings, toggles system users, and exposes backup artifact visibility', async () => {
    const staffPassword = 'StrongPass123!';
    await createUser({
      email: 'super@platform.test',
      password: 'StrongPass123!',
      roleName: 'SUPER_ADMIN'
    });

    const org = await prisma.organization.create({
      data: { name: 'Ops Org', code: 'ops-org' }
    });

    const staff = await createUser({
      email: 'staff@ops.test',
      password: staffPassword,
      roleName: 'ORG_STAFF',
      organizationId: org.id
    });

    const auth = await loginSuperAdmin({
      email: 'super@platform.test',
      password: 'StrongPass123!'
    });

    const saveSubscriptionRes = await request(app.getHttpServer())
      .put('/super-admin/settings/subscription')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        value: {
          plans: [{ code: 'enterprise', seats: 250 }],
          defaultPlan: 'enterprise'
        }
      });

    expect(saveSubscriptionRes.status).toBe(200);
    expect(saveSubscriptionRes.body.defaultPlan).toBe('enterprise');

    const saveCommsRes = await request(app.getHttpServer())
      .put('/super-admin/settings/communications')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        value: {
          emailProvider: 'ses',
          smsProvider: 'twilio',
          senderEmail: 'noreply@platform.test'
        }
      });

    expect(saveCommsRes.status).toBe(200);
    expect(saveCommsRes.body.emailProvider).toBe('ses');

    const saveBadgeTemplatesRes = await request(app.getHttpServer())
      .put('/super-admin/templates/badges/global')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        value: {
          templates: [{ id: 'vip-dark', name: 'VIP Dark' }]
        }
      });

    expect(saveBadgeTemplatesRes.status).toBe(200);
    expect(saveBadgeTemplatesRes.body.templates).toHaveLength(1);

    const saveRegTemplatesRes = await request(app.getHttpServer())
      .put('/super-admin/templates/registration-pages/global')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        value: {
          templates: [{ id: 'conference-clean', name: 'Conference Clean' }]
        }
      });

    expect(saveRegTemplatesRes.status).toBe(200);
    expect(saveRegTemplatesRes.body.templates).toHaveLength(1);

    const getSubscriptionRes = await request(app.getHttpServer())
      .get('/super-admin/settings/subscription')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(getSubscriptionRes.status).toBe(200);
    expect(getSubscriptionRes.body.defaultPlan).toBe('enterprise');

    const getCommunicationsRes = await request(app.getHttpServer())
      .get('/super-admin/settings/communications')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(getCommunicationsRes.status).toBe(200);
    expect(getCommunicationsRes.body.emailProvider).toBe('ses');
    expect(getCommunicationsRes.body.smsProvider).toBe('twilio');

    const getBadgeTemplatesRes = await request(app.getHttpServer())
      .get('/super-admin/templates/badges/global')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(getBadgeTemplatesRes.status).toBe(200);
    expect(getBadgeTemplatesRes.body.templates).toEqual([{ id: 'vip-dark', name: 'VIP Dark' }]);

    const getRegistrationTemplatesRes = await request(app.getHttpServer())
      .get('/super-admin/templates/registration-pages/global')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(getRegistrationTemplatesRes.status).toBe(200);
    expect(getRegistrationTemplatesRes.body.templates).toEqual([
      { id: 'conference-clean', name: 'Conference Clean' }
    ]);

    const toggleUserRes = await request(app.getHttpServer())
      .patch(`/super-admin/system/users/${staff.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ isActive: false });

    expect(toggleUserRes.status).toBe(200);
    expect(toggleUserRes.body.isActive).toBe(false);

    const updatedUser = await prisma.user.findUnique({ where: { id: staff.id } });
    expect(updatedUser?.isActive).toBe(false);

    const backupArtifactsRes = await request(app.getHttpServer())
      .get('/super-admin/operations/backup-restore')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(backupArtifactsRes.status).toBe(200);
    expect(Array.isArray(backupArtifactsRes.body.reports)).toBe(true);

    const triggerDrillRes = await request(app.getHttpServer())
      .post('/super-admin/operations/backup-restore/drill')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(triggerDrillRes.status).toBe(202);
    expect(triggerDrillRes.body.accepted).toBe(true);
    expect(triggerDrillRes.body.action).toBe('backup_restore_drill');
    expect(typeof triggerDrillRes.body.pid).toBe('number');
  });
});
