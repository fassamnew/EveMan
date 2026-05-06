import 'reflect-metadata';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../infra/db/prisma.service';
import { IdentityBootstrapService } from '../organizations/identity-bootstrap.service';

const runE2E = Boolean(process.env.DATABASE_URL);

describe.skipIf(!runE2E)('Public registration e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
    await prisma.auditLog.deleteMany();
    await prisma.registrantResponse.deleteMany();
    await prisma.registrant.deleteMany();
    await prisma.formField.deleteMany();
    await prisma.linkRule.deleteMany();
    await prisma.registrationLink.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
  });

  it('completes full public flow from schema to badge lookup', async () => {
    const org = await prisma.organization.create({
      data: { name: 'E2E Org', code: 'e2e-org' }
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'E2E Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'e2e-flow',
        title: 'E2E Flow',
        rule: {
          create: {
            visibility: 'PUBLIC',
            approvalMode: 'AUTO'
          }
        }
      }
    });

    await prisma.formField.create({
      data: {
        registrationLinkId: link.id,
        key: 'nickname',
        label: 'Nickname',
        type: 'TEXT',
        required: true,
        position: 1,
        minLength: 2
      }
    });

    const schema = await request(app.getHttpServer()).get('/public/register/e2e-flow/schema');
    expect(schema.status).toBe(200);
    expect(schema.body.fields).toHaveLength(1);

    const submit = await request(app.getHttpServer())
      .post('/public/register/e2e-flow/submissions')
      .send({
        fullName: 'E2E User',
        email: 'e2e@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-e2e',
        responses: [{ key: 'nickname', value: 'EU' }]
      });

    expect(submit.status).toBe(201);

    const lookup = await request(app.getHttpServer())
      .get('/public/register/lookup')
      .query({ referenceCode: submit.body.referenceCode, email: 'e2e@example.com' });

    expect(lookup.status).toBe(200);

    const badge = await request(app.getHttpServer())
      .get('/public/register/badge')
      .query({ referenceCode: submit.body.referenceCode, email: 'e2e@example.com' });

    expect(badge.status).toBe(200);
    expect(typeof badge.body.badgeText).toBe('string');
  });
});
