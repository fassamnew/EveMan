import 'reflect-metadata';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../infra/db/prisma.service';
import { IdentityBootstrapService } from '../organizations/identity-bootstrap.service';

const runIntegration = Boolean(process.env.DATABASE_URL);
const SYSTEM_ROLES: Array<{ name: RoleName; description: string }> = [
  { name: 'SUPER_ADMIN', description: 'Platform super administrator' },
  { name: 'ORG_ADMIN', description: 'Organization administrator' },
  { name: 'ORG_STAFF', description: 'Organization staff member' }
];

describe.skipIf(!runIntegration)('Registrations integration (MySQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
  });

  beforeEach(async () => {
    await clearTenantData();
    await ensureSystemRoles();
  });

  it('resolves schema, submits registration, and retrieves by reference', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Nova Org', code: 'nova' }
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Nova Summit',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'nova-summit-2026',
        title: 'Nova Summit Registration',
        rule: {
          create: {
            visibility: 'PUBLIC',
            capacity: 5,
            approvalMode: 'AUTO'
          }
        }
      }
    });

    await prisma.formField.createMany({
      data: [
        {
          registrationLinkId: link.id,
          key: 'country',
          label: 'Country',
          type: 'SELECT',
          required: true,
          position: 1,
          optionsJson: ['ET', 'US'] as any
        },
        {
          registrationLinkId: link.id,
          key: 'age',
          label: 'Age',
          type: 'NUMBER',
          required: true,
          position: 2,
          minValue: 18,
          maxValue: 120
        }
      ]
    });

    const resolveRes = await request(app.getHttpServer()).get('/public/register/nova-summit-2026');
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.event.name).toBe('Nova Summit');

    const schemaRes = await request(app.getHttpServer()).get('/public/register/nova-summit-2026/schema');
    expect(schemaRes.status).toBe(200);
    expect(schemaRes.body.fields).toHaveLength(2);
    expect(schemaRes.body.fields[0]).toMatchObject({
      key: 'country',
      type: 'SELECT',
      required: true
    });
    expect(schemaRes.body.fields[1]).toMatchObject({
      key: 'age',
      type: 'NUMBER',
      required: true
    });

    const submitRes = await request(app.getHttpServer())
      .post('/public/register/nova-summit-2026/submissions')
      .send({
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: [
          { key: 'country', value: 'ET' },
          { key: 'age', value: 31 }
        ]
      });

    expect(submitRes.status).toBe(201);
    expect(typeof submitRes.body.referenceCode).toBe('string');

    const retrieveRes = await request(app.getHttpServer())
      .get('/public/register/lookup')
      .query({
        referenceCode: submitRes.body.referenceCode,
        email: 'ada@example.com'
      });

    expect(retrieveRes.status).toBe(200);
    expect(retrieveRes.body.fullName).toBe('Ada Lovelace');
    expect(retrieveRes.body.link.slug).toBe('nova-summit-2026');

    const badgeRes = await request(app.getHttpServer())
      .get('/public/register/badge')
      .query({
        referenceCode: submitRes.body.referenceCode,
        email: 'ada@example.com'
      });

    expect(badgeRes.status).toBe(200);
    expect(typeof badgeRes.body.badgeText).toBe('string');
    expect(badgeRes.body.badgeText).toContain('Ada Lovelace');
  });

  it('enforces duplicate policy and capacity checks', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Lumen Org', code: 'lumen' }
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Lumen Expo',
        status: 'PUBLISHED'
      }
    });

    await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'lumen-expo',
        title: 'Lumen Expo Registration',
        rule: {
          create: {
            visibility: 'PUBLIC',
            capacity: 1,
            approvalMode: 'AUTO'
          }
        }
      }
    });

    const first = await request(app.getHttpServer())
      .post('/public/register/lumen-expo/submissions')
      .send({
        fullName: 'First Person',
        email: 'first@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: []
      });

    expect(first.status).toBe(201);

    const duplicate = await request(app.getHttpServer())
      .post('/public/register/lumen-expo/submissions')
      .send({
        fullName: 'First Person',
        email: 'first@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: []
      });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.existingReferenceCode).toBe(first.body.referenceCode);

    const capacity = await request(app.getHttpServer())
      .post('/public/register/lumen-expo/submissions')
      .send({
        fullName: 'Second Person',
        email: 'second@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: []
      });

    expect(capacity.status).toBe(400);
  });

  it('validates required and constrained dynamic fields', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Strict Org', code: 'strict' }
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Strict Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'strict-event',
        title: 'Strict Event Registration',
        rule: {
          create: {
            visibility: 'PUBLIC',
            approvalMode: 'AUTO'
          }
        }
      }
    });

    await prisma.formField.createMany({
      data: [
        {
          registrationLinkId: link.id,
          key: 'code',
          label: 'Code',
          type: 'TEXT',
          required: true,
          position: 1,
          minLength: 3,
          maxLength: 5,
          pattern: '^[A-Z]+$'
        },
        {
          registrationLinkId: link.id,
          key: 'terms',
          label: 'Accept Terms',
          type: 'CHECKBOX',
          required: true,
          position: 2
        },
        {
          registrationLinkId: link.id,
          key: 'score',
          label: 'Score',
          type: 'NUMBER',
          required: true,
          position: 3,
          minValue: 10,
          maxValue: 20
        }
      ]
    });

    const missingRequired = await request(app.getHttpServer())
      .post('/public/register/strict-event/submissions')
      .send({
        fullName: 'Test User',
        email: 'test1@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: [
          { key: 'terms', value: true },
          { key: 'score', value: 15 }
        ]
      });

    expect(missingRequired.status).toBe(400);

    const invalidPattern = await request(app.getHttpServer())
      .post('/public/register/strict-event/submissions')
      .send({
        fullName: 'Test User',
        email: 'test2@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: [
          { key: 'code', value: 'ab' },
          { key: 'terms', value: true },
          { key: 'score', value: 15 }
        ]
      });

    expect(invalidPattern.status).toBe(400);

    const invalidNumber = await request(app.getHttpServer())
      .post('/public/register/strict-event/submissions')
      .send({
        fullName: 'Test User',
        email: 'test3@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: [
          { key: 'code', value: 'ABC' },
          { key: 'terms', value: true },
          { key: 'score', value: 7 }
        ]
      });

    expect(invalidNumber.status).toBe(400);

    const invalidCheckbox = await request(app.getHttpServer())
      .post('/public/register/strict-event/submissions')
      .send({
        fullName: 'Test User',
        email: 'test4@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: [
          { key: 'code', value: 'ABCD' },
          { key: 'terms', value: false },
          { key: 'score', value: 12 }
        ]
      });

    expect(invalidCheckbox.status).toBe(400);

    const unknownField = await request(app.getHttpServer())
      .post('/public/register/strict-event/submissions')
      .send({
        fullName: 'Test User',
        email: 'test5@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: [
          { key: 'code', value: 'ABCD' },
          { key: 'terms', value: true },
          { key: 'score', value: 12 },
          { key: 'unknown', value: 'x' }
        ]
      });

    expect(unknownField.status).toBe(400);
  });
});
