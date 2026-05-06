import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { OrgAccessGuard } from '../common/guards/org-access.guard';
import { ManagementRateLimitGuard } from '../common/guards/management-rate-limit.guard';
import type { RequestWithAuth } from '../common/request-with-auth';
import { CreateImportJobDto } from './dto/create-import-job.dto';
import { ImportsService } from './imports.service';

@Controller()
export class ImportsController {
  constructor(@Inject(ImportsService) private readonly importsService: ImportsService) {}

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/imports/jobs')
  async createJob(
    @Param('orgCode') orgCode: string,
    @Body() dto: CreateImportJobDto,
    @Req() req: RequestWithAuth
  ) {
    return this.importsService.createJob({ orgCode, dto, req });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/imports/jobs')
  async listJobs(@Param('orgCode') orgCode: string, @Req() req: RequestWithAuth) {
    return this.importsService.listJobs({ orgCode, req });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/imports/jobs/:jobId/errors')
  async listErrors(
    @Param('orgCode') orgCode: string,
    @Param('jobId') jobId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.importsService.listErrors({ orgCode, jobId, req });
  }
}
