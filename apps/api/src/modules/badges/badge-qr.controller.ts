import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import type { Response } from 'express';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { OrgAccessGuard } from '../common/guards/org-access.guard';
import { ManagementRateLimitGuard } from '../common/guards/management-rate-limit.guard';
import { BadgeQrService } from './badge-qr.service';
import { VerifyQrDto } from './dto/verify-qr.dto';
import type { RequestWithAuth } from '../common/request-with-auth';
import { CreateBadgeTemplateDto } from './dto/create-badge-template.dto';
import { UpdateBadgeTemplateDto } from './dto/update-badge-template.dto';

@Controller()
export class BadgeQrController {
  constructor(@Inject(BadgeQrService) private readonly badgeQrService: BadgeQrService) {}

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/templates/badges')
  async createTemplate(
    @Param('orgCode') orgCode: string,
    @Body() dto: CreateBadgeTemplateDto,
    @Req() req: RequestWithAuth
  ) {
    return this.badgeQrService.createTemplate({
      orgCode,
      dto,
      req
    });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/templates/badges')
  async listTemplates(@Param('orgCode') orgCode: string, @Req() req: RequestWithAuth) {
    return this.badgeQrService.listTemplates({ orgCode, req });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Patch('org/:orgCode/templates/badges/:templateId')
  async updateTemplate(
    @Param('orgCode') orgCode: string,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateBadgeTemplateDto,
    @Req() req: RequestWithAuth
  ) {
    return this.badgeQrService.updateTemplate({
      orgCode,
      templateId,
      dto,
      req
    });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Delete('org/:orgCode/templates/badges/:templateId')
  async disableTemplate(
    @Param('orgCode') orgCode: string,
    @Param('templateId') templateId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.badgeQrService.disableTemplate({ orgCode, templateId, req });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/templates/badges/:templateId/assign/:linkId')
  async assignTemplate(
    @Param('orgCode') orgCode: string,
    @Param('templateId') templateId: string,
    @Param('linkId') linkId: string
  ) {
    return this.badgeQrService.assignTemplateToLink({
      orgCode,
      templateId,
      linkId
    });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Patch('org/:orgCode/registrants/:registrantId/badge/regenerate')
  async regenerate(
    @Param('orgCode') orgCode: string,
    @Param('registrantId') registrantId: string
  ) {
    return this.badgeQrService.regenerateBadge({ orgCode, registrantId });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/registrants/:registrantId/badge/download-url')
  async getDownloadUrl(
    @Param('orgCode') orgCode: string,
    @Param('registrantId') registrantId: string,
    @Query('expiresInSeconds') expiresInSeconds?: string
  ) {
    return this.badgeQrService.getBadgeDownloadUrl({
      orgCode,
      registrantId,
      expiresInSeconds
    });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/badges/renderer/metrics')
  async getRendererMetrics(@Param('orgCode') orgCode: string, @Req() req: RequestWithAuth) {
    return this.badgeQrService.getRendererMetrics({ orgCode, req });
  }

  @Get('public/badges/download')
  async downloadLocalBadge(
    @Query('path') path: string,
    @Query('expires') expires: string,
    @Query('sig') sig: string,
    @Res() res: Response
  ) {
    const result = await this.badgeQrService.getLocalBadgeDownload({
      path,
      expires,
      sig
    });

    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  }

  @Post('verify/qr')
  async verify(@Body() dto: VerifyQrDto) {
    return this.badgeQrService.verifyQr(dto.token);
  }
}
