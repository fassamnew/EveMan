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
    @Req() req: RequestWithAuth
  ) {
    return this.analyticsService.queueDashboardReport({
      orgCode,
      eventId,
      format,
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
