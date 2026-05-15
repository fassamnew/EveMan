import {
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import type { Response } from 'express';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { OrgAccessGuard } from '../common/guards/org-access.guard';
import type { RequestWithAuth } from '../common/request-with-auth';
import { AnalyticsService } from './analytics.service';

@Controller()
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analyticsService: AnalyticsService) {}

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/dashboard/overview')
  async getOverview(@Param('orgCode') orgCode: string, @Req() req: RequestWithAuth) {
    return this.analyticsService.getDashboardOverview(orgCode, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Post('org/:orgCode/dashboard/reports')
  async queueReport(
    @Param('orgCode') orgCode: string,
    @Query('eventId') eventId: string | undefined,
    @Query('format') format: string | undefined,
    @Query('dataset') dataset: string | undefined,
    @Req() req: RequestWithAuth
  ) {
    return this.analyticsService.queueDashboardReport({
      orgCode,
      eventId,
      format,
      dataset,
      req
    });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/dashboard/reports')
  async listReports(@Param('orgCode') orgCode: string, @Req() req: RequestWithAuth) {
    return this.analyticsService.listDashboardReports({ orgCode, req });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Post('org/:orgCode/dashboard/reports/:reportId/download-link')
  async createDownloadLink(
    @Param('orgCode') orgCode: string,
    @Param('reportId') reportId: string,
    @Query('expiresInSeconds') expiresInSeconds: string | undefined,
    @Req() req: RequestWithAuth
  ) {
    return this.analyticsService.createDashboardReportDownloadUrl({
      orgCode,
      reportId,
      expiresInSeconds,
      req
    });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/analytics/category-breakdown')
  async getCategoryBreakdown(@Param('orgCode') orgCode: string, @Req() req: RequestWithAuth) {
    return this.analyticsService.getCategoryBreakdown(orgCode, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/analytics/link-breakdown')
  async getLinkBreakdown(@Param('orgCode') orgCode: string, @Req() req: RequestWithAuth) {
    return this.analyticsService.getLinkBreakdown(orgCode, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/analytics/scan-metrics')
  async getScanMetrics(
    @Param('orgCode') orgCode: string,
    @Query('eventId') eventId: string | undefined,
    @Req() req: RequestWithAuth
  ) {
    return this.analyticsService.getScanAttemptMetrics(orgCode, eventId, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/analytics/last-scanned')
  async getLastScanned(
    @Param('orgCode') orgCode: string,
    @Query('eventId') eventId: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: RequestWithAuth
  ) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100) : 20;
    return this.analyticsService.getLastScannedAttendees(orgCode, eventId, parsedLimit, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/analytics/no-show')
  async getNoShow(
    @Param('orgCode') orgCode: string,
    @Query('eventId') eventId: string | undefined,
    @Req() req: RequestWithAuth
  ) {
    return this.analyticsService.getNoShowAnalysis(orgCode, eventId, req);
  }

  @Get('public/reports/download')
  async getPublicReportDownload(
    @Query('path') path: string,
    @Query('reportId') reportId: string,
    @Query('orgId') orgId: string,
    @Query('expires') expires: string,
    @Query('sig') sig: string,
    @Res() res: Response
  ) {
    const payload = await this.analyticsService.getPublicReportDownload({
      path,
      reportId,
      orgId,
      expires,
      sig
    });

    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${payload.filename}"`);
    res.send(payload.content);
  }
}
