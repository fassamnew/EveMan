import { describe, expect, it, vi } from 'vitest';
import { AnalyticsController } from './analytics.controller';

function createHarness() {
  const analyticsService = {
    getDashboardOverview: vi.fn(),
    queueDashboardReport: vi.fn(),
    listDashboardReports: vi.fn(),
    createDashboardReportDownloadUrl: vi.fn(),
    getPublicReportDownload: vi.fn()
  } as any;

  const controller = new AnalyticsController(analyticsService);

  return {
    controller,
    analyticsService
  };
}

describe('AnalyticsController', () => {
  it('delegates queueReport to service with org and filters', async () => {
    const { controller, analyticsService } = createHarness();

    analyticsService.queueDashboardReport.mockResolvedValue({
      reportId: 'r-1',
      status: 'QUEUED'
    });

    const req = {
      auth: {
        userId: 'admin-1',
        roles: ['ORG_ADMIN'],
        organizationCode: 'acme'
      }
    } as any;

    const result = await controller.queueReport('acme', 'event-1', 'csv', 'FULL_REGISTRATION_LIST', req);

    expect(result).toEqual({ reportId: 'r-1', status: 'QUEUED' });
    expect(analyticsService.queueDashboardReport).toHaveBeenCalledWith({
      orgCode: 'acme',
      eventId: 'event-1',
      format: 'csv',
      dataset: 'FULL_REGISTRATION_LIST',
      req
    });
  });

  it('delegates download link creation with expires override', async () => {
    const { controller, analyticsService } = createHarness();

    analyticsService.createDashboardReportDownloadUrl.mockResolvedValue({
      reportId: 'r-1',
      downloadUrl: 'http://signed.example/report'
    });

    const req = {
      auth: {
        userId: 'admin-1',
        roles: ['ORG_ADMIN'],
        organizationCode: 'acme'
      }
    } as any;

    const result = await controller.createDownloadLink('acme', 'r-1', '600', req);

    expect(result.downloadUrl).toBe('http://signed.example/report');
    expect(analyticsService.createDashboardReportDownloadUrl).toHaveBeenCalledWith({
      orgCode: 'acme',
      reportId: 'r-1',
      expiresInSeconds: '600',
      req
    });
  });

  it('writes download headers and body for public report download', async () => {
    const { controller, analyticsService } = createHarness();

    analyticsService.getPublicReportDownload.mockResolvedValue({
      filename: 'r-1.csv',
      contentType: 'text/csv; charset=utf-8',
      content: 'eventId,eventName\n1,Sample'
    });

    const res = {
      setHeader: vi.fn(),
      send: vi.fn()
    } as any;

    await controller.getPublicReportDownload(
      'reports/org-1/r-1.csv',
      'r-1',
      'org-1',
      '1715100000000',
      'sig-1',
      res
    );

    expect(analyticsService.getPublicReportDownload).toHaveBeenCalledWith({
      path: 'reports/org-1/r-1.csv',
      reportId: 'r-1',
      orgId: 'org-1',
      expires: '1715100000000',
      sig: 'sig-1'
    });
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="r-1.csv"');
    expect(res.send).toHaveBeenCalledWith('eventId,eventName\n1,Sample');
  });
});
