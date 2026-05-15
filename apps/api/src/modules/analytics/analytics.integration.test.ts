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

describe.skipIf(!runIntegration)('Analytics dashboard integration (MySQL)', () => {
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
        organizationId: input.orgId
      }
    });

    return { id: user.id };
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

  async function waitForReportCompletion(input: {
    orgCode: string;
    reportId: string;
    accessToken: string;
    timeoutMs?: number;
  }): Promise<void> {
    const timeoutMs = input.timeoutMs || 10_000;
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const list = await request(app.getHttpServer())
        .get(`/org/${input.orgCode}/dashboard/reports`)
        .set('Authorization', `Bearer ${input.accessToken}`);

      expect(list.status).toBe(200);

      const item = (list.body.reports as Array<{ reportId: string; status: string }>).find(
        row => row.reportId === input.reportId
      );

      if (item?.status === 'COMPLETED') {
        return;
      }

      if (item?.status === 'FAILED') {
        throw new Error('Report generation moved to FAILED state');
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('Timed out waiting for report completion');
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
    badgeQrService = app.get(BadgeQrService);
  });

  beforeEach(async () => {
    await clearTenantData();
    await ensureSystemRoles();
  });

  it('returns dashboard KPIs, trends, event performance, and usher performance', async () => {
    const org = await prisma.organization.create({ data: { name: 'Analytics Org', code: 'analyticsorg' } });

    await createOrgUser({
      email: 'admin@analytics.org',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const usher = await createOrgUser({
      email: 'usher@analytics.org',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_STAFF',
      firstName: 'Alex',
      lastName: 'Usher'
    });

    const auth = await loginOrgUser({
      email: 'admin@analytics.org',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Analytics Event',
        status: 'PUBLISHED'
      }
    });

    const link = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'analytics-link',
        title: 'Analytics Link'
      }
    });

    const registrantA = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'AN001',
        email: 'a@analytics.org',
        fullName: 'Registrant A',
        lifecycleStatus: 'APPROVED',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: link.id,
        referenceCode: 'AN002',
        email: 'b@analytics.org',
        fullName: 'Registrant B',
        lifecycleStatus: 'APPROVED',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    const issued = await badgeQrService.issueForRegistrant({ registrantId: registrantA.id });

    await prisma.checkin.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrantId: registrantA.id,
        usherUserId: usher.id,
        deviceId: 'analytics-device',
        idempotencyKey: 'analytics-checkin-001',
        source: 'MOBILE_ONLINE',
        syncState: 'ACCEPTED',
        scannedAt: new Date()
      }
    });

    await prisma.communicationLog.createMany({
      data: [
        {
          organizationId: org.id,
          registrantId: registrantA.id,
          channel: 'EMAIL',
          status: 'SENT',
          recipientAddress: 'a@analytics.org'
        },
        {
          organizationId: org.id,
          registrantId: registrantA.id,
          channel: 'EMAIL',
          status: 'FAILED',
          recipientAddress: 'a@analytics.org',
          errorMessage: 'provider down'
        }
      ]
    });

    expect(issued.badgeId).toBeTruthy();

    const response = await request(app.getHttpServer())
      .get('/org/analyticsorg/dashboard/overview')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.cached).toBe(false);
    expect(response.body.kpis.totalEvents).toBe(1);
    expect(response.body.kpis.publishedEvents).toBe(1);
    expect(response.body.kpis.totalRegistrants).toBe(2);
    expect(response.body.kpis.totalCheckins).toBe(1);
    expect(response.body.kpis.communicationSent).toBe(1);
    expect(response.body.kpis.communicationFailed).toBe(1);
    expect(Array.isArray(response.body.trends)).toBe(true);
    expect(response.body.trends.length).toBe(7);
    expect(response.body.eventPerformance[0].communicationsSent).toBe(1);
    expect(response.body.eventPerformance[0].communicationsFailed).toBe(1);
    expect(response.body.usherPerformance[0].usherUserId).toBe(usher.id);
    expect(response.body.usherPerformance[0].scans).toBe(1);

    const second = await request(app.getHttpServer())
      .get('/org/analyticsorg/dashboard/overview')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);
  });

  it('returns category breakdown, scan metrics, last scanned attendees, and no-show analysis', async () => {
    const org = await prisma.organization.create({ data: { name: 'Section15 Org', code: 'section15org' } });

    await createOrgUser({
      email: 'admin@section15.org',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const usher = await createOrgUser({
      email: 'usher@section15.org',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_STAFF',
      firstName: 'Door',
      lastName: 'Agent'
    });

    const auth = await loginOrgUser({
      email: 'admin@section15.org',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Section 15 Event',
        status: 'PUBLISHED'
      }
    });

    const vipLink = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'vip-section15',
        title: 'VIP'
      }
    });

    const generalLink = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        slug: 'general-section15',
        title: 'General'
      }
    });

    const approvedCheckedIn = await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: vipLink.id,
        referenceCode: 'S15001',
        email: 'checkedin@section15.org',
        fullName: 'Checked In Attendee',
        lifecycleStatus: 'APPROVED',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    await prisma.registrant.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrationLinkId: generalLink.id,
        referenceCode: 'S15002',
        email: 'noshow@section15.org',
        fullName: 'No Show Attendee',
        lifecycleStatus: 'APPROVED',
        consentAccepted: true,
        consentPolicyVersion: 'v1',
        consentCapturedAt: new Date()
      }
    });

    const scannedAt = new Date();
    await prisma.checkin.create({
      data: {
        organizationId: org.id,
        eventId: event.id,
        registrantId: approvedCheckedIn.id,
        usherUserId: usher.id,
        deviceId: 'gate-device-1',
        idempotencyKey: 'section15-checkin-1',
        source: 'MOBILE_ONLINE',
        syncState: 'ACCEPTED',
        entrance: 'Main Gate',
        scannedAt
      }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: usher.id,
        organizationId: org.id,
        action: 'USHER_CHECKIN_DUPLICATE',
        targetType: 'REGISTRANT',
        targetId: approvedCheckedIn.id,
        outcome: 'FAILURE',
        metadataJson: {
          eventId: event.id,
          reason: 'DUPLICATE'
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: usher.id,
        organizationId: org.id,
        action: 'USHER_CHECKIN_INVALID',
        targetType: 'CHECKIN',
        targetId: null,
        outcome: 'FAILURE',
        metadataJson: {
          eventId: event.id,
          reason: 'TOKEN_SIGNATURE_INVALID'
        }
      }
    });

    const categoryRes = await request(app.getHttpServer())
      .get('/org/section15org/analytics/category-breakdown')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(categoryRes.status).toBe(200);
    expect(Array.isArray(categoryRes.body.breakdown)).toBe(true);
    expect(categoryRes.body.breakdown.find((row: { category: string }) => row.category === 'VIP')).toBeTruthy();

    const scanMetricsRes = await request(app.getHttpServer())
      .get('/org/section15org/analytics/scan-metrics')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(scanMetricsRes.status).toBe(200);
    expect(scanMetricsRes.body.metrics.accepted).toBe(1);
    expect(scanMetricsRes.body.metrics.duplicate).toBe(1);
    expect(scanMetricsRes.body.metrics.invalid).toBe(1);
    expect(scanMetricsRes.body.metrics.byEntrance['Main Gate']).toBe(1);
    expect(scanMetricsRes.body.metrics.byCategory['VIP']).toBe(1);

    const linkBreakdownRes = await request(app.getHttpServer())
      .get('/org/section15org/analytics/link-breakdown')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(linkBreakdownRes.status).toBe(200);
    expect(Array.isArray(linkBreakdownRes.body.breakdown)).toBe(true);
    const vipLinkBreakdown = linkBreakdownRes.body.breakdown.find((row: { title: string }) => row.title === 'VIP');
    expect(vipLinkBreakdown).toBeTruthy();
    expect(vipLinkBreakdown.registrations).toBe(1);
    expect(vipLinkBreakdown.checkins).toBe(1);

    const lastScannedRes = await request(app.getHttpServer())
      .get('/org/section15org/analytics/last-scanned?limit=5')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(lastScannedRes.status).toBe(200);
    expect(lastScannedRes.body.attendees.length).toBe(1);
    expect(lastScannedRes.body.attendees[0].fullName).toBe('Checked In Attendee');
    expect(lastScannedRes.body.attendees[0].entrance).toBe('Main Gate');

    const noShowRes = await request(app.getHttpServer())
      .get('/org/section15org/analytics/no-show')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(noShowRes.status).toBe(200);
    expect(noShowRes.body.analysis.approvedCount).toBe(2);
    expect(noShowRes.body.analysis.checkedInCount).toBe(1);
    expect(noShowRes.body.analysis.noShowCount).toBe(1);
  });

  it('requires auth for dashboard endpoint', async () => {
    const org = await prisma.organization.create({ data: { name: 'Auth Org', code: 'authorg' } });
    expect(org.id).toBeTruthy();

    const response = await request(app.getHttpServer()).get('/org/authorg/dashboard/overview');
    expect(response.status).toBe(401);
  });

  it('allows org admin to queue and list export reports', async () => {
    const org = await prisma.organization.create({ data: { name: 'Report Org', code: 'reportorg' } });

    await createOrgUser({
      email: 'admin@report.org',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@report.org',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const queued = await request(app.getHttpServer())
      .post('/org/reportorg/dashboard/reports?format=csv&dataset=NO_SHOW_LIST')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(queued.status).toBe(201);
    expect(queued.body.reportId).toBeTruthy();
    expect(queued.body.status).toBe('QUEUED');
    expect(queued.body.dataset).toBe('NO_SHOW_LIST');

    const listed = await request(app.getHttpServer())
      .get('/org/reportorg/dashboard/reports')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(listed.status).toBe(200);
    expect(Array.isArray(listed.body.reports)).toBe(true);
    const queuedItem = listed.body.reports.find(
      (item: { reportId: string; dataset: string }) => item.reportId === queued.body.reportId
    );
    expect(queuedItem).toBeTruthy();
    expect(queuedItem.dataset).toBe('NO_SHOW_LIST');
  });

  it('forbids org staff from queueing export reports', async () => {
    const org = await prisma.organization.create({ data: { name: 'Staff Org', code: 'stafforg' } });

    await createOrgUser({
      email: 'staff@staff.org',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_STAFF'
    });

    const auth = await loginOrgUser({
      email: 'staff@staff.org',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const response = await request(app.getHttpServer())
      .post('/org/stafforg/dashboard/reports?format=json')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(response.status).toBe(403);
  });

  it('generates signed report download link and serves public report artifact', async () => {
    const org = await prisma.organization.create({ data: { name: 'Download Org', code: 'downloadorg' } });

    await createOrgUser({
      email: 'admin@download.org',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const auth = await loginOrgUser({
      email: 'admin@download.org',
      password: 'StrongPass123!',
      orgId: org.id
    });

    await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Download Event',
        status: 'PUBLISHED'
      }
    });

    const queued = await request(app.getHttpServer())
      .post('/org/downloadorg/dashboard/reports?format=csv')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(queued.status).toBe(201);
    expect(queued.body.reportId).toBeTruthy();

    await waitForReportCompletion({
      orgCode: 'downloadorg',
      reportId: queued.body.reportId as string,
      accessToken: auth.accessToken
    });

    const link = await request(app.getHttpServer())
      .post(`/org/downloadorg/dashboard/reports/${queued.body.reportId}/download-link`)
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(link.status).toBe(201);
    expect(typeof link.body.downloadUrl).toBe('string');

    const url = new URL(link.body.downloadUrl as string);
    if (url.pathname === '/public/reports/download') {
      const publicDownload = await request(app.getHttpServer())
        .get('/public/reports/download')
        .query({
          path: url.searchParams.get('path'),
          reportId: url.searchParams.get('reportId'),
          orgId: url.searchParams.get('orgId'),
          expires: url.searchParams.get('expires'),
          sig: url.searchParams.get('sig')
        });

      expect(publicDownload.status).toBe(200);
      expect(publicDownload.headers['content-type']).toContain('text/csv');
      expect(publicDownload.headers['content-disposition']).toContain('attachment; filename=');
      expect(publicDownload.text).toContain('eventId,eventName');
    } else {
      const publicDownload = await fetch(link.body.downloadUrl as string);

      expect(publicDownload.status).toBe(200);
      expect(publicDownload.headers.get('content-type') || '').toContain('text/csv');
      expect(await publicDownload.text()).toContain('eventId,eventName');
    }
  });

  it('returns consistent analytics under larger seeded dataset within expected response bounds', async () => {
    const org = await prisma.organization.create({ data: { name: 'Scale Org', code: 'scaleorg' } });

    await createOrgUser({
      email: 'admin@scale.org',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_ADMIN'
    });

    const usherA = await createOrgUser({
      email: 'usher-a@scale.org',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_STAFF',
      firstName: 'Usher',
      lastName: 'A'
    });

    const usherB = await createOrgUser({
      email: 'usher-b@scale.org',
      password: 'StrongPass123!',
      orgId: org.id,
      roleName: 'ORG_STAFF',
      firstName: 'Usher',
      lastName: 'B'
    });

    const auth = await loginOrgUser({
      email: 'admin@scale.org',
      password: 'StrongPass123!',
      orgId: org.id
    });

    const eventA = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Scale Event A',
        status: 'PUBLISHED'
      }
    });

    const eventB = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Scale Event B',
        status: 'PUBLISHED'
      }
    });

    const linkA = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: eventA.id,
        slug: 'scale-a',
        title: 'Scale Link A'
      }
    });

    const linkB = await prisma.registrationLink.create({
      data: {
        organizationId: org.id,
        eventId: eventB.id,
        slug: 'scale-b',
        title: 'Scale Link B'
      }
    });

    const registrantsA = Array.from({ length: 80 }).map((_, i) => ({
      organizationId: org.id,
      eventId: eventA.id,
      registrationLinkId: linkA.id,
      referenceCode: `SCA${String(i + 1).padStart(4, '0')}`,
      email: `a${i + 1}@scale.org`,
      fullName: `Scale A ${i + 1}`,
      lifecycleStatus: 'APPROVED' as const,
      consentAccepted: true,
      consentPolicyVersion: 'v1',
      consentCapturedAt: new Date()
    }));

    const registrantsB = Array.from({ length: 70 }).map((_, i) => ({
      organizationId: org.id,
      eventId: eventB.id,
      registrationLinkId: linkB.id,
      referenceCode: `SCB${String(i + 1).padStart(4, '0')}`,
      email: `b${i + 1}@scale.org`,
      fullName: `Scale B ${i + 1}`,
      lifecycleStatus: 'APPROVED' as const,
      consentAccepted: true,
      consentPolicyVersion: 'v1',
      consentCapturedAt: new Date()
    }));

    await prisma.registrant.createMany({
      data: [...registrantsA, ...registrantsB]
    });

    const persisted = await prisma.registrant.findMany({
      where: {
        organizationId: org.id
      },
      select: {
        id: true,
        eventId: true,
        email: true
      }
    });

    const checkins = persisted
      .filter((_, i) => i % 2 === 0)
      .map((registrant, i) => ({
        organizationId: org.id,
        eventId: registrant.eventId,
        registrantId: registrant.id,
        usherUserId: i % 3 === 0 ? usherA.id : usherB.id,
        deviceId: 'scale-device',
        idempotencyKey: `scale-checkin-${i + 1}`,
        source: 'MOBILE_ONLINE' as const,
        syncState: 'ACCEPTED' as const,
        scannedAt: new Date()
      }));

    await prisma.checkin.createMany({ data: checkins });

    const commLogs = persisted.flatMap((registrant, i) => {
      const sent = {
        organizationId: org.id,
        registrantId: registrant.id,
        channel: 'EMAIL' as const,
        status: 'SENT' as const,
        recipientAddress: registrant.email
      };

      const failed = {
        organizationId: org.id,
        registrantId: registrant.id,
        channel: 'EMAIL' as const,
        status: i % 5 === 0 ? ('FAILED' as const) : ('SENT' as const),
        recipientAddress: registrant.email,
        errorMessage: i % 5 === 0 ? 'simulated failure' : null
      };

      return [sent, failed];
    });

    await prisma.communicationLog.createMany({ data: commLogs });

    const started = Date.now();
    const response = await request(app.getHttpServer())
      .get('/org/scaleorg/dashboard/overview')
      .set('Authorization', `Bearer ${auth.accessToken}`);
    const elapsedMs = Date.now() - started;

    expect(response.status).toBe(200);
    expect(response.body.cached).toBe(false);
    expect(response.body.kpis.totalEvents).toBe(2);
    expect(response.body.kpis.publishedEvents).toBe(2);
    expect(response.body.kpis.totalRegistrants).toBe(150);
    expect(response.body.kpis.totalCheckins).toBe(checkins.length);
    expect(response.body.kpis.communicationSent).toBe(commLogs.filter(row => row.status === 'SENT').length);
    expect(response.body.kpis.communicationFailed).toBe(
      commLogs.filter(row => row.status === 'FAILED').length
    );
    expect(response.body.eventPerformance.length).toBe(2);
    expect(response.body.usherPerformance.length).toBeGreaterThan(0);

    // Baseline response-time guard for local integration regression detection.
    expect(elapsedMs).toBeLessThan(5000);
  });
});
