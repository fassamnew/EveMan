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
});
