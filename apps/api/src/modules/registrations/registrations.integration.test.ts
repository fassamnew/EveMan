import 'reflect-metadata';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
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
    await prisma.migrationMetadata.deleteMany();
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

    await prisma.migrationMetadata.createMany({
      data: [
        {
          key: `link:${link.id}:settings:pageTemplate`,
          value: 'CONFERENCE'
        },
        {
          key: `link:${link.id}:settings:pageBackgroundColor`,
          value: '#123456'
        },
        {
          key: `link:${link.id}:settings:sponsorLogoUrls`,
          value: JSON.stringify(['https://cdn.example.com/sponsor.png'])
        },
        {
          key: `link:${link.id}:settings:footerText`,
          value: 'Questions? support@example.com'
        }
      ]
    });

    const resolveStyledRes = await request(app.getHttpServer()).get('/public/register/nova-summit-2026');
    expect(resolveStyledRes.status).toBe(200);
    expect(resolveStyledRes.body.pageDesign.template).toBe('CONFERENCE');
    expect(resolveStyledRes.body.pageDesign.backgroundColor).toBe('#123456');
    expect(resolveStyledRes.body.pageDesign.sponsorLogoUrls).toEqual(['https://cdn.example.com/sponsor.png']);

    const schemaRes = await request(app.getHttpServer()).get('/public/register/nova-summit-2026/schema');
    expect(schemaRes.status).toBe(200);
    expect(schemaRes.body.fields).toHaveLength(2);
    expect(schemaRes.body.pageDesign.footerText).toBe('Questions? support@example.com');
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
    expect(typeof badgeRes.body.badgeStatus).toBe('string');
    if (badgeRes.body.badgeStatus === 'READY') {
      expect(typeof badgeRes.body.badgeDownloadUrl).toBe('string');
    }
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

  it('applies advanced approval rules based on registrant responses', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Rule Org', code: 'ruleorg' }
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Rule Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'rule-event',
        title: 'Rule Event Registration',
        rule: {
          create: {
            visibility: 'PUBLIC',
            approvalMode: 'MANUAL'
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
          type: 'TEXT',
          required: true,
          position: 0
        },
        {
          registrationLinkId: link.id,
          key: 'age',
          label: 'Age',
          type: 'NUMBER',
          required: true,
          position: 1
        }
      ]
    });

    await prisma.migrationMetadata.createMany({
      data: [
        {
          key: `link:${link.id}:approval-rule:${randomUUID()}`,
          value: JSON.stringify({ fieldKey: 'country', operator: 'EQ', value: 'banned', action: 'REJECT', order: 0 })
        },
        {
          key: `link:${link.id}:approval-rule:${randomUUID()}`,
          value: JSON.stringify({ fieldKey: 'age', operator: 'GTE', value: '18', action: 'APPROVE', order: 1 })
        }
      ]
    });

    const rejected = await request(app.getHttpServer())
      .post('/public/register/rule-event/submissions')
      .send({
        fullName: 'Rejected User',
        email: 'reject@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: [
          { key: 'country', value: 'banned' },
          { key: 'age', value: 35 }
        ]
      });

    expect(rejected.status).toBe(201);
    expect(rejected.body.status).toBe('REJECTED');

    const approved = await request(app.getHttpServer())
      .post('/public/register/rule-event/submissions')
      .send({
        fullName: 'Approved User',
        email: 'approve@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: [
          { key: 'country', value: 'et' },
          { key: 'age', value: 22 }
        ]
      });

    expect(approved.status).toBe(201);
    expect(approved.body.status).toBe('CONFIRMED');

    const pending = await request(app.getHttpServer())
      .post('/public/register/rule-event/submissions')
      .send({
        fullName: 'Pending User',
        email: 'pending@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: [
          { key: 'country', value: 'et' },
          { key: 'age', value: 15 }
        ]
      });

    expect(pending.status).toBe(201);
    expect(pending.body.status).toBe('PENDING_APPROVAL');
  });

  it('dispatches webhook for confirmed registrations', async () => {
    const deliveries: Array<{ headers: Record<string, string | string[] | undefined>; body: any }> = [];
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      req.on('end', () => {
        deliveries.push({
          headers: req.headers,
          body: JSON.parse(Buffer.concat(chunks).toString('utf-8'))
        });
        res.statusCode = 204;
        res.end();
      });
    });

    const port = await new Promise<number>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          resolve(0);
          return;
        }
        resolve(address.port);
      });
    });

    const org = await prisma.organization.create({
      data: { name: 'Webhook Org', code: 'webhook' }
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Webhook Event',
        status: 'PUBLISHED'
      }
    });

    await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'webhook-event',
        title: 'Webhook Event Registration',
        rule: {
          create: {
            visibility: 'PUBLIC',
            approvalMode: 'AUTO'
          }
        }
      }
    });

    await prisma.migrationMetadata.create({
      data: {
        key: `org:${org.id}:webhook:${randomUUID()}`,
        value: `u=${encodeURIComponent(`http://127.0.0.1:${port}/hook`)}&e=REGISTRATION_CONFIRMED&a=1&s=test-secret`
      }
    });

    const submitRes = await request(app.getHttpServer())
      .post('/public/register/webhook-event/submissions')
      .send({
        fullName: 'Webhook User',
        email: 'webhook@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: []
      });

    expect(submitRes.status).toBe(201);

    const delivered = await new Promise<boolean>(resolve => {
      const deadline = Date.now() + 3000;
      const tick = () => {
        if (deliveries.length > 0) {
          resolve(true);
          return;
        }
        if (Date.now() > deadline) {
          resolve(false);
          return;
        }
        setTimeout(tick, 50);
      };
      tick();
    });

    await new Promise<void>(resolve => server.close(() => resolve()));

    expect(delivered).toBe(true);
    expect(deliveries[0].headers['x-evemange-event']).toBe('REGISTRATION_CONFIRMED');
    expect(typeof deliveries[0].headers['x-evemange-signature']).toBe('string');
    expect(deliveries[0].body.eventType).toBe('REGISTRATION_CONFIRMED');
    expect(deliveries[0].body.data.organizationCode).toBe('webhook');
  });

  it('issues QR and queues badge delivery for confirmed registrations', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Delivery Org', code: 'delivery' }
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Delivery Event',
        status: 'PUBLISHED'
      }
    });

    await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'delivery-link',
        title: 'Delivery Link',
        rule: {
          create: {
            visibility: 'PUBLIC',
            approvalMode: 'AUTO'
          }
        }
      }
    });

    const submitRes = await request(app.getHttpServer())
      .post('/public/register/delivery-link/submissions')
      .send({
        fullName: 'Delivery User',
        email: 'delivery@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: []
      });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.status).toBe('CONFIRMED');
    expect(submitRes.body.qrIssued).toBe(true);
    expect(submitRes.body.badgeDeliveryQueued).toBe(true);

    const registrant = await prisma.registrant.findUnique({
      where: { referenceCode: submitRes.body.referenceCode as string },
      select: { id: true }
    });

    expect(registrant).not.toBeNull();

    const qrCount = await prisma.qrCode.count({
      where: {
        registrantId: registrant?.id || ''
      }
    });
    expect(qrCount).toBeGreaterThan(0);

    const badgeCount = await prisma.badge.count({
      where: {
        registrantId: registrant?.id || ''
      }
    });
    expect(badgeCount).toBeGreaterThan(0);
  });

  it('enforces PASSWORD_PROTECTED and INVITE_ONLY link access modes', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Protected Org', code: 'protected' }
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Protected Event',
        status: 'PUBLISHED'
      }
    });

    const protectedLink = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'protected-link',
        title: 'Protected Link',
        rule: {
          create: {
            visibility: 'PUBLIC',
            approvalMode: 'AUTO'
          }
        }
      }
    });

    await prisma.migrationMetadata.createMany({
      data: [
        {
          key: `link:${protectedLink.id}:settings:accessMode`,
          value: 'PASSWORD_PROTECTED'
        },
        {
          key: `link:${protectedLink.id}:settings:accessPassword`,
          value: 'letmein'
        }
      ]
    });

    const resolveDenied = await request(app.getHttpServer()).get('/public/register/protected-link');
    expect(resolveDenied.status).toBe(403);

    const resolveAllowed = await request(app.getHttpServer())
      .get('/public/register/protected-link')
      .query({ accessPassword: 'letmein' });
    expect(resolveAllowed.status).toBe(200);

    const submitDenied = await request(app.getHttpServer())
      .post('/public/register/protected-link/submissions')
      .send({
        fullName: 'Protected User',
        email: 'protected@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: []
      });
    expect(submitDenied.status).toBe(403);

    const submitAllowed = await request(app.getHttpServer())
      .post('/public/register/protected-link/submissions')
      .send({
        fullName: 'Protected User',
        email: 'protected@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        accessPassword: 'letmein',
        responses: []
      });
    expect(submitAllowed.status).toBe(201);

    const inviteLink = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'invite-link',
        title: 'Invite Link',
        rule: {
          create: {
            visibility: 'PUBLIC',
            approvalMode: 'AUTO'
          }
        }
      }
    });

    await prisma.migrationMetadata.createMany({
      data: [
        {
          key: `link:${inviteLink.id}:settings:accessMode`,
          value: 'INVITE_ONLY'
        },
        {
          key: `link:${inviteLink.id}:settings:accessPassword`,
          value: 'invite-token-123'
        }
      ]
    });

    const inviteResolveDenied = await request(app.getHttpServer()).get('/public/register/invite-link');
    expect(inviteResolveDenied.status).toBe(403);

    const inviteResolveAllowed = await request(app.getHttpServer())
      .get('/public/register/invite-link')
      .query({ inviteToken: 'invite-token-123' });
    expect(inviteResolveAllowed.status).toBe(200);

    const inviteSubmitDenied = await request(app.getHttpServer())
      .post('/public/register/invite-link/submissions')
      .send({
        fullName: 'Invite User',
        email: 'invite@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: []
      });
    expect(inviteSubmitDenied.status).toBe(403);

    const inviteSubmitAllowed = await request(app.getHttpServer())
      .post('/public/register/invite-link/submissions')
      .send({
        fullName: 'Invite User',
        email: 'invite@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        inviteToken: 'invite-token-123',
        responses: []
      });
    expect(inviteSubmitAllowed.status).toBe(201);
  });

  it('enforces photo upload policy for REQUIRED, OPTIONAL, and DISABLED modes', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Photo Org', code: 'photoorg' }
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Photo Event',
        status: 'PUBLISHED'
      }
    });

    const requiredLink = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'photo-required',
        title: 'Photo Required Link',
        rule: {
          create: {
            visibility: 'PUBLIC',
            approvalMode: 'AUTO'
          }
        }
      }
    });

    await prisma.migrationMetadata.create({
      data: {
        key: `link:${requiredLink.id}:settings:photoUpload`,
        value: 'REQUIRED'
      }
    });

    const schemaRequired = await request(app.getHttpServer()).get('/public/register/photo-required/schema');
    expect(schemaRequired.status).toBe(200);
    expect(schemaRequired.body.photoUpload).toBe('REQUIRED');

    const requiredDenied = await request(app.getHttpServer())
      .post('/public/register/photo-required/submissions')
      .send({
        fullName: 'Required Photo User',
        email: 'required-denied@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: []
      });
    expect(requiredDenied.status).toBe(400);

    const requiredAllowed = await request(app.getHttpServer())
      .post('/public/register/photo-required/submissions')
      .send({
        fullName: 'Required Photo User',
        email: 'required-allowed@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        photoUrl: 'https://example.com/photo-required.jpg',
        responses: []
      });
    expect(requiredAllowed.status).toBe(201);

    const requiredRegistrant = await prisma.registrant.findUnique({
      where: { referenceCode: requiredAllowed.body.referenceCode },
      include: { responses: true }
    });
    expect(requiredRegistrant).not.toBeNull();
    expect(requiredRegistrant?.responses.some(r => r.fieldKey === '__photo_upload__')).toBe(true);

    const optionalLink = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'photo-optional',
        title: 'Photo Optional Link',
        rule: {
          create: {
            visibility: 'PUBLIC',
            approvalMode: 'AUTO'
          }
        }
      }
    });

    await prisma.migrationMetadata.create({
      data: {
        key: `link:${optionalLink.id}:settings:photoUpload`,
        value: 'OPTIONAL'
      }
    });

    const schemaOptional = await request(app.getHttpServer()).get('/public/register/photo-optional/schema');
    expect(schemaOptional.status).toBe(200);
    expect(schemaOptional.body.photoUpload).toBe('OPTIONAL');

    const optionalAllowed = await request(app.getHttpServer())
      .post('/public/register/photo-optional/submissions')
      .send({
        fullName: 'Optional Photo User',
        email: 'optional-allowed@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        photoUrl: 'https://example.com/photo-optional.jpg',
        responses: []
      });
    expect(optionalAllowed.status).toBe(201);

    const disabledLink = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'photo-disabled',
        title: 'Photo Disabled Link',
        rule: {
          create: {
            visibility: 'PUBLIC',
            approvalMode: 'AUTO'
          }
        }
      }
    });

    await prisma.migrationMetadata.create({
      data: {
        key: `link:${disabledLink.id}:settings:photoUpload`,
        value: 'DISABLED'
      }
    });

    const schemaDisabled = await request(app.getHttpServer()).get('/public/register/photo-disabled/schema');
    expect(schemaDisabled.status).toBe(200);
    expect(schemaDisabled.body.photoUpload).toBe('DISABLED');

    const disabledDenied = await request(app.getHttpServer())
      .post('/public/register/photo-disabled/submissions')
      .send({
        fullName: 'Disabled Photo User',
        email: 'disabled-denied@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        photoUrl: 'https://example.com/photo-disabled.jpg',
        responses: []
      });
    expect(disabledDenied.status).toBe(400);

    const disabledAllowed = await request(app.getHttpServer())
      .post('/public/register/photo-disabled/submissions')
      .send({
        fullName: 'Disabled Photo User',
        email: 'disabled-allowed@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: []
      });
    expect(disabledAllowed.status).toBe(201);
  });

  it('allows registrant self-update only when link setting is enabled', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Update Org', code: 'updateorg' }
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Update Event',
        status: 'PUBLISHED'
      }
    });

    const blockedLink = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'update-blocked',
        title: 'Update Blocked',
        rule: {
          create: {
            visibility: 'PUBLIC',
            approvalMode: 'AUTO'
          }
        }
      }
    });

    const blockedSubmit = await request(app.getHttpServer())
      .post('/public/register/update-blocked/submissions')
      .send({
        fullName: 'Blocked User',
        email: 'blocked@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: []
      });

    expect(blockedSubmit.status).toBe(201);

    const blockedUpdate = await request(app.getHttpServer())
      .patch(`/public/register/update-blocked/submissions/${blockedSubmit.body.referenceCode as string}`)
      .send({
        email: 'blocked@example.com',
        fullName: 'Blocked User Updated'
      });

    expect(blockedUpdate.status).toBe(403);

    const allowedLink = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'update-allowed',
        title: 'Update Allowed',
        rule: {
          create: {
            visibility: 'PUBLIC',
            approvalMode: 'AUTO'
          }
        }
      }
    });

    await prisma.migrationMetadata.create({
      data: {
        key: `link:${allowedLink.id}:settings:allowRegistrantUpdate`,
        value: '1'
      }
    });

    const allowedSubmit = await request(app.getHttpServer())
      .post('/public/register/update-allowed/submissions')
      .send({
        fullName: 'Allowed User',
        email: 'allowed@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: []
      });

    expect(allowedSubmit.status).toBe(201);

    const allowedUpdate = await request(app.getHttpServer())
      .patch(`/public/register/update-allowed/submissions/${allowedSubmit.body.referenceCode as string}`)
      .send({
        email: 'allowed@example.com',
        fullName: 'Allowed User Updated',
        photoUrl: 'https://example.com/updated-photo.jpg'
      });

    expect(allowedUpdate.status).toBe(200);
    expect(allowedUpdate.body.updated).toBe(true);

    const updatedRegistrant = await prisma.registrant.findUnique({
      where: {
        referenceCode: allowedSubmit.body.referenceCode as string
      },
      include: {
        responses: true
      }
    });

    expect(updatedRegistrant?.fullName).toBe('Allowed User Updated');
    expect(updatedRegistrant?.responses.some(r => r.fieldKey === '__photo_upload__')).toBe(true);
  });

  it('queues SMS delivery when optional SMS configuration is enabled', async () => {
    const org = await prisma.organization.create({
      data: { name: 'SMS Org', code: 'smsorg' }
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'SMS Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'sms-link',
        title: 'SMS Link',
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
        key: 'phone',
        label: 'Phone',
        type: 'TEXT',
        required: true,
        position: 1
      }
    });

    const smsTemplate = await prisma.communicationTemplate.create({
      data: {
        organizationId: org.id,
        name: 'registration-sms',
        channel: 'SMS',
        body: 'Your registration is confirmed',
        isActive: true
      }
    });

    await prisma.migrationMetadata.createMany({
      data: [
        {
          key: `link:${link.id}:settings:smsDeliveryEnabled`,
          value: '1'
        },
        {
          key: `link:${link.id}:settings:smsTemplateName`,
          value: smsTemplate.name
        },
        {
          key: `link:${link.id}:settings:smsRecipientFieldKey`,
          value: 'phone'
        }
      ]
    });

    const submitRes = await request(app.getHttpServer())
      .post('/public/register/sms-link/submissions')
      .send({
        fullName: 'SMS User',
        email: 'sms@example.com',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        captchaToken: 'dev-token-123',
        responses: [{ key: 'phone', value: '+251911111111' }]
      });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.smsQueued).toBe(true);

    const registrant = await prisma.registrant.findUnique({
      where: { referenceCode: submitRes.body.referenceCode as string },
      select: { id: true }
    });

    expect(registrant).not.toBeNull();

    const smsLogs = await prisma.communicationLog.findMany({
      where: {
        registrantId: registrant?.id || '',
        channel: 'SMS'
      }
    });

    expect(smsLogs.length).toBeGreaterThan(0);
    expect(smsLogs[0].recipientAddress).toBe('+251911111111');
  });

  it('validates DATE field with min/max date constraints', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Date Org', code: 'dateorg' }
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Date Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'date-link',
        title: 'Date Link'
      }
    });

    const minDate = new Date('2026-05-01');
    const maxDate = new Date('2026-05-31');

    await prisma.formField.createMany({
      data: [
        {
          registrationLinkId: link.id,
          key: 'full_name',
          label: 'Full Name',
          type: 'TEXT',
          required: true,
          position: 0
        },
        {
          registrationLinkId: link.id,
          key: 'email',
          label: 'Email',
          type: 'EMAIL',
          required: true,
          position: 1
        },
        {
          registrationLinkId: link.id,
          key: 'arrival_date',
          label: 'Arrival Date',
          type: 'DATE',
          required: true,
          minDate,
          maxDate,
          position: 2
        }
      ]
    });

    // Test schema includes date field configuration
    const schema = await request(app.getHttpServer())
      .get('/public/register/date-link/schema')
      .expect(200);

    const dateField = schema.body.fields.find((f: any) => f.key === 'arrival_date');
    expect(dateField).toBeDefined();
    expect(dateField.type).toBe('DATE');
    expect(dateField.minDate).toBe(minDate.toISOString());
    expect(dateField.maxDate).toBe(maxDate.toISOString());

    // Submit with valid date
    const validResp = await request(app.getHttpServer())
      .post('/public/register/date-link/submissions')
      .send({
        fullName: 'Date User',
        email: 'date@example.com',
        consentAccepted: true,
        consentPolicyVersion: '1.0',
        captchaToken: 'dev-token-123',
        responses: [
          { key: 'full_name', value: 'Date User' },
          { key: 'email', value: 'date@example.com' },
          { key: 'arrival_date', value: '2026-05-15' }
        ]
      });

    if (validResp.status !== 201) {
      console.log('ERROR submitting DATE field:', validResp.status, validResp.body);
    }
    expect(validResp.status).toBe(201);
    expect(validResp.body.referenceCode).toBeDefined();

    // Submit with date before min should fail
    const earlyResp = await request(app.getHttpServer())
      .post('/public/register/date-link/submissions')
      .send({
        fullName: 'Early User',
        email: 'early@example.com',
        consentAccepted: true,
        consentPolicyVersion: '1.0',
        captchaToken: 'dev-token-123',
        responses: [
          { key: 'full_name', value: 'Early User' },
          { key: 'email', value: 'early@example.com' },
          { key: 'arrival_date', value: '2026-04-30' }
        ]
      });

    expect(earlyResp.status).toBe(400);

    // Submit with date after max should fail
    const lateResp = await request(app.getHttpServer())
      .post('/public/register/date-link/submissions')
      .send({
        fullName: 'Late User',
        email: 'late@example.com',
        consentAccepted: true,
        consentPolicyVersion: '1.0',
        captchaToken: 'dev-token-123',
        responses: [
          { key: 'full_name', value: 'Late User' },
          { key: 'email', value: 'late@example.com' },
          { key: 'arrival_date', value: '2026-06-01' }
        ]
      });

    expect(lateResp.status).toBe(400);
  });

  it('validates RADIO_BUTTON field options', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Radio Org', code: 'radioorg' }
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Radio Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'radio-link',
        title: 'Radio Link'
      }
    });

    await prisma.formField.createMany({
      data: [
        {
          registrationLinkId: link.id,
          key: 'full_name',
          label: 'Full Name',
          type: 'TEXT',
          required: true,
          position: 0
        },
        {
          registrationLinkId: link.id,
          key: 'email',
          label: 'Email',
          type: 'EMAIL',
          required: true,
          position: 1
        },
        {
          registrationLinkId: link.id,
          key: 'meal_preference',
          label: 'Meal Preference',
          type: 'RADIO_BUTTON',
          required: true,
          optionsJson: ['Vegetarian', 'Vegan', 'Non-vegetarian'] as any,
          position: 2
        }
      ]
    });

    const schema = await request(app.getHttpServer())
      .get('/public/register/radio-link/schema')
      .expect(200);

    const mealField = schema.body.fields.find((f: any) => f.key === 'meal_preference');
    expect(mealField).toBeDefined();
    expect(mealField.type).toBe('RADIO_BUTTON');
    expect(mealField.options).toEqual(['Vegetarian', 'Vegan', 'Non-vegetarian']);

    // Submit with valid option
    const validSubmit = await request(app.getHttpServer())
      .post('/public/register/radio-link/submissions')
      .send({
        fullName: 'Radio User',
        email: 'radio@example.com',
        consentAccepted: true,
        consentPolicyVersion: '1.0',
        captchaToken: 'dev-token-123',
        responses: [
          { key: 'full_name', value: 'Radio User' },
          { key: 'email', value: 'radio@example.com' },
          { key: 'meal_preference', value: 'Vegetarian' }
        ]
      })
      .expect(201);

    expect(validSubmit.body.referenceCode).toBeDefined();

    // Submit with invalid option
    await request(app.getHttpServer())
      .post('/public/register/radio-link/submissions')
      .send({
        fullName: 'Invalid User',
        email: 'invalid@example.com',
        consentAccepted: true,
        consentPolicyVersion: '1.0',
        captchaToken: 'dev-token-123',
        responses: [
          { key: 'full_name', value: 'Invalid User' },
          { key: 'email', value: 'invalid@example.com' },
          { key: 'meal_preference', value: 'InvalidOption' }
        ]
      })
      .expect(400);
  });

  it('validates FILE_UPLOAD field with MIME type and size constraints', async () => {
    const org = await prisma.organization.create({
      data: { name: 'File Org', code: 'fileorg' }
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'File Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'file-link',
        title: 'File Link'
      }
    });

    await prisma.formField.createMany({
      data: [
        {
          registrationLinkId: link.id,
          key: 'full_name',
          label: 'Full Name',
          type: 'TEXT',
          required: true,
          position: 0
        },
        {
          registrationLinkId: link.id,
          key: 'email',
          label: 'Email',
          type: 'EMAIL',
          required: true,
          position: 1
        },
        {
          registrationLinkId: link.id,
          key: 'id_document',
          label: 'ID Document',
          type: 'FILE_UPLOAD',
          required: true,
          allowedFileTypesJson: ['application/pdf', 'image/jpeg', 'image/png'] as any,
          maxFileSize: 5 * 1024 * 1024,
          position: 2
        }
      ]
    });

    const schema = await request(app.getHttpServer())
      .get('/public/register/file-link/schema')
      .expect(200);

    const fileField = schema.body.fields.find((f: any) => f.key === 'id_document');
    expect(fileField).toBeDefined();
    expect(fileField.type).toBe('FILE_UPLOAD');
    expect(fileField.allowedFileTypes).toEqual(['application/pdf', 'image/jpeg', 'image/png']);
    expect(fileField.maxFileSize).toBe(5 * 1024 * 1024);

    // Submit with file URL (validation happens at upload endpoint)
    const validSubmit = await request(app.getHttpServer())
      .post('/public/register/file-link/submissions')
      .send({
        fullName: 'File User',
        email: 'file@example.com',
        consentAccepted: true,
        consentPolicyVersion: '1.0',
        captchaToken: 'dev-token-123',
        responses: [
          { key: 'full_name', value: 'File User' },
          { key: 'email', value: 'file@example.com' },
          { key: 'id_document', value: 'https://example.com/docs/id.pdf' }
        ]
      })
      .expect(201);

    expect(validSubmit.body.referenceCode).toBeDefined();

    // Submit with invalid URL
    await request(app.getHttpServer())
      .post('/public/register/file-link/submissions')
      .send({
        fullName: 'Bad URL User',
        email: 'badurl@example.com',
        consentAccepted: true,
        consentPolicyVersion: '1.0',
        captchaToken: 'dev-token-123',
        responses: [
          { key: 'full_name', value: 'Bad URL User' },
          { key: 'email', value: 'badurl@example.com' },
          { key: 'id_document', value: 'not-a-valid-url' }
        ]
      })
      .expect(400);
  });
});
