import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards
} from '@nestjs/common';
import type { Response } from 'express';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { OrgAccessGuard } from '../common/guards/org-access.guard';
import { ManagementRateLimitGuard } from '../common/guards/management-rate-limit.guard';
import { BadgeQrService } from './badge-qr.service';
import { VerifyQrDto } from './dto/verify-qr.dto';

@Controller()
export class BadgeQrController {
  constructor(@Inject(BadgeQrService) private readonly badgeQrService: BadgeQrService) {}

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
