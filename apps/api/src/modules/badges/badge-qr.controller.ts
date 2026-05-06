import {
  Body,
  Controller,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common';
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

  @Post('verify/qr')
  async verify(@Body() dto: VerifyQrDto) {
    return this.badgeQrService.verifyQr(dto.token);
  }
}
