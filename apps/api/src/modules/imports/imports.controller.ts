import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { OrgAccessGuard } from '../common/guards/org-access.guard';
import { ManagementRateLimitGuard } from '../common/guards/management-rate-limit.guard';
import type { RequestWithAuth } from '../common/request-with-auth';
import { CreateImportJobDto } from './dto/create-import-job.dto';
import { ImportsService } from './imports.service';
import { FileInterceptor } from '@nestjs/platform-express';

type ImportJobRequestBody = {
  sourceFilename?: string;
  sourceFileType?: 'CSV' | 'XLSX';
  duplicateStrategy?: 'SKIP' | 'UPDATE' | 'FLAG';
  mappingProfile?: string;
  eventId?: string;
  registrationLinkId?: string;
  fileContentBase64?: string;
};

type UploadedImportFile = {
  originalname: string;
  buffer: Buffer;
};

@Controller()
export class ImportsController {
  constructor(@Inject(ImportsService) private readonly importsService: ImportsService) {}

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @UseInterceptors(FileInterceptor('file'))
  @Post('org/:orgCode/imports/jobs')
  async createJob(
    @Param('orgCode') orgCode: string,
    @Body() body: ImportJobRequestBody,
    @Req() req: RequestWithAuth,
    @UploadedFile() file?: UploadedImportFile
  ) {
    let parsedMappingProfile: CreateImportJobDto['mappingProfile'] = { fullName: 'name', email: 'email' };
    if (body.mappingProfile) {
      try {
        parsedMappingProfile = JSON.parse(body.mappingProfile) as CreateImportJobDto['mappingProfile'];
      } catch {
        throw new BadRequestException('mappingProfile must be valid JSON');
      }
    }

    const dto: CreateImportJobDto = {
      sourceFilename: body.sourceFilename || file?.originalname || 'attendees.csv',
      sourceFileType: body.sourceFileType || ((file?.originalname || '').toLowerCase().endsWith('.xlsx') ? 'XLSX' : 'CSV'),
      duplicateStrategy: body.duplicateStrategy || 'FLAG',
      mappingProfile: parsedMappingProfile,
      eventId: body.eventId || '',
      registrationLinkId: body.registrationLinkId,
      fileContentBase64: body.fileContentBase64
    };

    if (!dto.eventId) {
      throw new BadRequestException('eventId is required');
    }

    return this.importsService.createJob({ orgCode, dto, req, fileBuffer: file?.buffer });
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
