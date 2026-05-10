import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from './analytics.service';
import { getSystemQueue } from '../../infra/queue/queue.provider';
import {
  createReportSignedDownloadUrl,
  isValidLocalReportSignature,
  readLocalReportArtifact
} from '../../infra/storage/report-storage.util';

vi.mock('../../infra/queue/queue.provider', () => ({
  getSystemQueue: vi.fn()
}));

vi.mock('../../infra/storage/report-storage.util', () => ({
  createReportSignedDownloadUrl: vi.fn(),
  isValidLocalReportSignature: vi.fn(),
  readLocalReportArtifact: vi.fn()
}));

function createHarness() {
  const prisma = {
    organization: {
      findUnique: vi.fn()
    },
    event: {
      findFirst: vi.fn()
    }
  } as any;

  const policy = {
    canAccessTenant: vi.fn()
  } as any;

  const audit = {
    write: vi.fn()
  } as any;

  const service = new AnalyticsService(prisma, policy, audit);

  return {
    service,
    prisma,
    policy,
    audit
  };
}

describe('AnalyticsService report exports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks queueing export for staff role', async () => {
    const { service, policy } = createHarness();
    policy.canAccessTenant.mockReturnValue(true);

    await expect(
      service.queueDashboardReport({
        orgCode: 'acme',
        format: 'csv',
        req: {
          auth: {
            userId: 'staff-1',
            roles: ['ORG_STAFF'],
            organizationCode: 'acme'
          }
        } as any
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('queues analytics report for org admin', async () => {
    const { service, prisma, policy, audit } = createHarness();
    const queue = {
      add: vi.fn().mockResolvedValue({ id: 'report-1' })
    } as any;

    vi.mocked(getSystemQueue).mockReturnValue(queue);
    policy.canAccessTenant.mockReturnValue(true);
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', code: 'acme', name: 'Acme' });

    const result = await service.queueDashboardReport({
      orgCode: 'acme',
      format: 'json',
      req: {
        auth: {
          userId: 'admin-1',
          roles: ['ORG_ADMIN'],
          organizationCode: 'acme'
        },
        headers: {},
        ip: '127.0.0.1'
      } as any
    });

    expect(result.status).toBe('QUEUED');
    expect(result.format).toBe('json');
    expect(queue.add).toHaveBeenCalledWith(
      'analytics.report.generate',
      expect.objectContaining({
        organizationId: 'org-1',
        format: 'json'
      }),
      expect.objectContaining({
        attempts: 2
      })
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REPORT_EXPORT_QUEUED',
        organizationId: 'org-1'
      })
    );
  });

  it('lists report jobs filtered by organization', async () => {
    const { service, prisma, policy } = createHarness();

    const matchingJob = {
      name: 'analytics.report.generate',
      data: { reportId: 'r-1', organizationId: 'org-1', format: 'csv' },
      returnvalue: { rowCount: 12, storagePath: 'local://reports/org-1/r-1.csv' },
      failedReason: null,
      timestamp: Date.now(),
      finishedOn: Date.now(),
      getState: vi.fn().mockResolvedValue('completed')
    };

    const nonMatchingJob = {
      name: 'analytics.report.generate',
      data: { reportId: 'r-2', organizationId: 'org-2', format: 'csv' },
      returnvalue: {},
      failedReason: null,
      timestamp: Date.now(),
      finishedOn: null,
      getState: vi.fn().mockResolvedValue('waiting')
    };

    const queue = {
      getJobs: vi.fn().mockResolvedValue([matchingJob, nonMatchingJob])
    } as any;

    vi.mocked(getSystemQueue).mockReturnValue(queue);
    policy.canAccessTenant.mockReturnValue(true);
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', code: 'acme', name: 'Acme' });

    const result = await service.listDashboardReports({
      orgCode: 'acme',
      req: {
        auth: {
          userId: 'admin-1',
          roles: ['ORG_ADMIN'],
          organizationCode: 'acme'
        }
      } as any
    });

    expect(result.reports.length).toBe(1);
    expect(result.reports[0]).toEqual(
      expect.objectContaining({
        reportId: 'r-1',
        status: 'COMPLETED',
        rowCount: 12,
        downloadReady: true
      })
    );
  });

  it('creates signed download link for completed report', async () => {
    const { service, prisma, policy, audit } = createHarness();

    const queue = {
      getJob: vi.fn().mockResolvedValue({
        name: 'analytics.report.generate',
        data: { organizationId: 'org-1', format: 'csv' },
        returnvalue: {
          storagePath: 'local://reports/org-1/r-1.csv',
          contentType: 'text/csv; charset=utf-8',
          generatedAt: '2026-01-01T00:00:00.000Z'
        },
        getState: vi.fn().mockResolvedValue('completed')
      })
    } as any;

    vi.mocked(getSystemQueue).mockReturnValue(queue);
    vi.mocked(createReportSignedDownloadUrl).mockResolvedValue('http://signed.example/report');
    policy.canAccessTenant.mockReturnValue(true);
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', code: 'acme', name: 'Acme' });

    const result = await service.createDashboardReportDownloadUrl({
      orgCode: 'acme',
      reportId: 'r-1',
      req: {
        auth: {
          userId: 'admin-1',
          roles: ['ORG_ADMIN'],
          organizationCode: 'acme'
        },
        headers: {},
        ip: '127.0.0.1'
      } as any
    });

    expect(result.downloadUrl).toBe('http://signed.example/report');
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REPORT_EXPORT_DOWNLOAD_LINK_ISSUED',
        targetId: 'r-1'
      })
    );
  });

  it('returns local report content for valid public signature', async () => {
    const { service, audit } = createHarness();

    vi.mocked(isValidLocalReportSignature).mockReturnValue(true);
    vi.mocked(readLocalReportArtifact).mockResolvedValue('eventId,eventName\n1,Sample');

    const result = await service.getPublicReportDownload({
      path: 'reports/org-1/r-1.csv',
      reportId: 'r-1',
      orgId: 'org-1',
      expires: String(Date.now() + 30_000),
      sig: 'abc123'
    });

    expect(result.filename).toBe('r-1.csv');
    expect(result.content).toContain('eventId,eventName');
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REPORT_EXPORT_DOWNLOADED',
        targetId: 'r-1'
      })
    );
  });

  it('uses forwarded ip for export audit entries', async () => {
    const { service, prisma, policy, audit } = createHarness();
    const queue = {
      add: vi.fn().mockResolvedValue({ id: 'report-1' })
    } as any;

    vi.mocked(getSystemQueue).mockReturnValue(queue);
    policy.canAccessTenant.mockReturnValue(true);
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', code: 'acme', name: 'Acme' });

    await service.queueDashboardReport({
      orgCode: 'acme',
      format: 'csv',
      req: {
        auth: {
          userId: 'admin-1',
          roles: ['ORG_ADMIN'],
          organizationCode: 'acme'
        },
        headers: {
          'x-forwarded-for': '203.0.113.5, 10.0.0.1'
        },
        ip: '127.0.0.1'
      } as any
    });

    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        ipAddress: '203.0.113.5'
      })
    );
  });

  it('rejects download link creation when report is not completed', async () => {
    const { service, prisma, policy } = createHarness();

    const queue = {
      getJob: vi.fn().mockResolvedValue({
        name: 'analytics.report.generate',
        data: { organizationId: 'org-1', format: 'csv' },
        returnvalue: {
          storagePath: 'local://reports/org-1/r-1.csv'
        },
        getState: vi.fn().mockResolvedValue('active')
      })
    } as any;

    vi.mocked(getSystemQueue).mockReturnValue(queue);
    policy.canAccessTenant.mockReturnValue(true);
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', code: 'acme', name: 'Acme' });

    await expect(
      service.createDashboardReportDownloadUrl({
        orgCode: 'acme',
        reportId: 'r-1',
        req: {
          auth: {
            userId: 'admin-1',
            roles: ['ORG_ADMIN'],
            organizationCode: 'acme'
          },
          headers: {},
          ip: '127.0.0.1'
        } as any
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid public report signature', async () => {
    const { service, audit } = createHarness();

    vi.mocked(isValidLocalReportSignature).mockReturnValue(false);

    await expect(
      service.getPublicReportDownload({
        path: 'reports/org-1/r-1.csv',
        reportId: 'r-1',
        orgId: 'org-1',
        expires: String(Date.now() + 30_000),
        sig: 'bad'
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(audit.write).not.toHaveBeenCalled();
  });
});
