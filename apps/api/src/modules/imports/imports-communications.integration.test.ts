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

describe.skipIf(!runIntegration)('Phase 5 imports and communications integration (MySQL)', () => {
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

  it('processes import jobs with duplicate strategy and row errors', async () => {
    const org = await prisma.organization.create({ data: { name: 'Import Org', code: 'importorg' } });

    await createOrgUser({
      email: 'admin@importorg.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@importorg.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Import Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'import-event',
        title: 'Import Registration'
      }
    });

    await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'EXIST123',
        email: 'existing@import.com',
        fullName: 'Existing Person',
        lifecycleStatus: 'APPROVED',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    const importRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/imports/jobs`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        sourceFilename: 'attendees.csv',
        sourceFileType: 'CSV',
        duplicateStrategy: 'FLAG',
        mappingProfile: {
          fullName: 'name',
          email: 'email'
        },
        eventId: event.id,
        registrationLinkId: link.id,
        fileContentBase64: Buffer.from(
          [
            'name,email',
            'New Person,new@import.com',
            'Duplicate Person,existing@import.com',
            'Broken Person,'
          ].join('\n'),
          'utf8'
        ).toString('base64')
      });

    expect(importRes.status).toBe(201);

    for (let i = 0; i < 40; i += 1) {
      const job = await prisma.importJob.findUnique({
        where: { id: importRes.body.jobId as string },
        select: {
          status: true,
          failedRows: true,
          successfulRows: true
        }
      });

      if (job?.status === 'FAILED' || job?.status === 'COMPLETED') {
        expect(job.successfulRows).toBe(1);
        expect(job.failedRows).toBe(2);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const errorsRes = await request(app.getHttpServer())
      .get(`/org/${org.code}/imports/jobs/${importRes.body.jobId as string}/errors`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(errorsRes.status).toBe(200);
    expect((errorsRes.body as Array<{ id: string }>).length).toBe(2);
  });

  it('supports communication template CRUD and bulk send with failure simulation', async () => {
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

    const okRegistrant = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'COMMS001',
        email: 'ok@comms.com',
        fullName: 'Ok Recipient',
        lifecycleStatus: 'APPROVED',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    const failRegistrant = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'COMMS002',
        email: 'fail@comms.com',
        fullName: 'Fail Recipient',
        lifecycleStatus: 'APPROVED',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    const createTemplateRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/communications/templates`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        name: 'Reminder',
        channel: 'EMAIL',
        subject: 'Event Reminder',
        body: 'Hello {{fullName}}'
      });

    expect(createTemplateRes.status).toBe(201);

    const updateTemplateRes = await request(app.getHttpServer())
      .patch(`/org/${org.code}/communications/templates/${createTemplateRes.body.id as string}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        body: 'Updated {{fullName}} message'
      });

    expect(updateTemplateRes.status).toBe(200);

    const bulkRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/communications/bulk-send`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        templateId: createTemplateRes.body.id,
        attendeeIds: [okRegistrant.id, failRegistrant.id]
      });

    expect(bulkRes.status).toBe(201);
    expect(bulkRes.body.queued).toBe(2);

    for (let i = 0; i < 60; i += 1) {
      const logs = await prisma.communicationLog.findMany({
        where: {
          organizationId: org.id
        }
      });

      const done = logs.every(item => item.status !== 'QUEUED');
      if (logs.length === 2 && done) {
        const sentCount = logs.filter(item => item.status === 'SENT').length;
        const failedCount = logs.filter(item => item.status === 'FAILED').length;
        expect(sentCount).toBe(1);
        expect(failedCount).toBe(1);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const listLogsRes = await request(app.getHttpServer())
      .get(`/org/${org.code}/communications/logs`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(listLogsRes.status).toBe(200);
    expect((listLogsRes.body as Array<{ id: string }>).length).toBeGreaterThanOrEqual(2);
  });

  it('supports scheduled bulk communications delivery', async () => {
    const org = await prisma.organization.create({ data: { name: 'Scheduled Org', code: 'schedorg' } });

    await createOrgUser({
      email: 'admin@schedorg.com',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@schedorg.com',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Scheduled Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'scheduled-event',
        title: 'Scheduled Registration'
      }
    });

    const registrant = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'SCHED001',
        email: 'scheduled@comms.com',
        fullName: 'Scheduled Recipient',
        lifecycleStatus: 'APPROVED',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    const createTemplateRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/communications/templates`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        name: 'Scheduled Reminder',
        channel: 'EMAIL',
        subject: 'Scheduled Subject',
        body: 'Scheduled hello {{fullName}}'
      });

    expect(createTemplateRes.status).toBe(201);

    const sendAt = new Date(Date.now() + 2000).toISOString();
    const queueRes = await request(app.getHttpServer())
      .post(`/org/${org.code}/communications/bulk-send`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        templateId: createTemplateRes.body.id,
        attendeeIds: [registrant.id],
        sendAt
      });

    expect(queueRes.status).toBe(201);
    expect(queueRes.body.scheduledFor).toBe(sendAt);

    const queuedLog = await prisma.communicationLog.findFirst({
      where: {
        organizationId: org.id,
        registrantId: registrant.id
      },
      orderBy: { createdAt: 'desc' }
    });

    expect(queuedLog?.status).toBe('QUEUED');

    let delivered = false;
    for (let i = 0; i < 60; i += 1) {
      const current = await prisma.communicationLog.findUnique({
        where: { id: queuedLog!.id }
      });

      if (current?.status === 'SENT') {
        delivered = true;
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    expect(delivered).toBe(true);
  });
});
