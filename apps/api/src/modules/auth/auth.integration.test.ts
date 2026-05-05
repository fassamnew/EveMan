import 'reflect-metadata';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../infra/db/prisma.service';
import { PasswordService } from '../common/password.service';
import type { INestApplication } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { IdentityBootstrapService } from '../organizations/identity-bootstrap.service';

const runIntegration = Boolean(process.env.DATABASE_URL);
const SYSTEM_ROLES: Array<{ name: RoleName; description: string }> = [
  { name: 'SUPER_ADMIN', description: 'Platform super administrator' },
  { name: 'ORG_ADMIN', description: 'Organization administrator' },
  { name: 'ORG_STAFF', description: 'Organization staff member' }
];

describe.skipIf(!runIntegration)('Auth integration (MySQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  async function getRoleId(name: RoleName): Promise<string> {
    const role = await prisma.role.findUnique({ where: { name } });
    if (!role) {
      throw new Error(`Missing role ${name}`);
    }
    return role.id;
  }

  async function clearIdentityData(): Promise<void> {
    await prisma.auditLog.deleteMany();
    await prisma.invite.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
  }

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

  async function createOrgAdminUser(input: {
    email: string;
    password: string;
    orgId: string;
  }): Promise<void> {
    const roleId = await getRoleId('ORG_ADMIN');
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
    await clearIdentityData();
    await ensureSystemRoles();
  });

  it('rotates refresh tokens and revokes old token', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Acme', code: 'acme' }
    });

    await createOrgAdminUser({
      email: 'admin@acme.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const loginRes = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'admin@acme.com',
      password: 'StrongPass123!',
      orgCode: 'acme'
    });

    expect(loginRes.status).toBe(201);
    const firstRefresh = loginRes.body.refreshToken as string;

    const refreshRes = await request(app.getHttpServer()).post('/auth/refresh').send({
      refreshToken: firstRefresh
    });

    expect(refreshRes.status).toBe(201);
    const secondRefresh = refreshRes.body.refreshToken as string;

    const tokens = await prisma.refreshToken.findMany({
      orderBy: { createdAt: 'asc' }
    });

    expect(tokens.length).toBe(2);
    expect(tokens[0].revokedAt).not.toBeNull();
    expect(tokens[1].revokedAt).toBeNull();

    const logoutRes = await request(app.getHttpServer()).post('/auth/logout').send({
      refreshToken: secondRefresh
    });

    expect(logoutRes.status).toBe(204);

    const activeCount = await prisma.refreshToken.count({ where: { revokedAt: null } });
    expect(activeCount).toBe(0);
  });

  it('blocks cross-tenant invite attempts', async () => {
    const orgA = await prisma.organization.create({
      data: { name: 'Org A', code: 'orga' }
    });
    const orgB = await prisma.organization.create({
      data: { name: 'Org B', code: 'orgb' }
    });

    await createOrgAdminUser({
      email: 'admin@orga.com',
      password: 'StrongPass123!',
      orgId: orgA.id
    });

    const loginRes = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'admin@orga.com',
      password: 'StrongPass123!',
      orgCode: 'orga'
    });

    expect(loginRes.status).toBe(201);

    const inviteRes = await request(app.getHttpServer())
      .post(`/org/${orgB.code}/users/invite`)
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .send({
        email: 'new.user@orgb.com',
        roleName: 'ORG_STAFF'
      });

    expect(inviteRes.status).toBe(403);
  });

  it('invited user can activate account and login', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Rocket Org', code: 'rocket' }
    });

    await createOrgAdminUser({
      email: 'admin@rocket.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const adminLogin = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'admin@rocket.com',
      password: 'StrongPass123!',
      orgCode: 'rocket'
    });

    expect(adminLogin.status).toBe(201);

    const inviteRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/users/invite`)
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .send({
        email: 'invitee@rocket.com',
        roleName: 'ORG_STAFF'
      });

    expect(inviteRes.status).toBe(201);

    const activateRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/users/activate`)
      .send({
        token: inviteRes.body.inviteToken,
        password: 'InviteePass123!',
        firstName: 'New',
        lastName: 'Member'
      });

    expect(activateRes.status).toBe(201);
    expect(activateRes.body.activated).toBe(true);

    const userLogin = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'invitee@rocket.com',
      password: 'InviteePass123!',
      orgCode: 'rocket'
    });

    expect(userLogin.status).toBe(201);
    expect(userLogin.body.user.email).toBe('invitee@rocket.com');
  });
});
