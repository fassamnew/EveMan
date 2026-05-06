import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { OrgAccessGuard } from '../common/guards/org-access.guard';
import { ManagementRateLimitGuard } from '../common/guards/management-rate-limit.guard';
import type { RequestWithAuth } from '../common/request-with-auth';
import { CommunicationsService } from './communications.service';
import { CreateBulkSendDto } from './dto/create-bulk-send.dto';
import { CreateCommunicationTemplateDto } from './dto/create-communication-template.dto';
import { UpdateCommunicationTemplateDto } from './dto/update-communication-template.dto';

@Controller()
export class CommunicationsController {
  constructor(@Inject(CommunicationsService) private readonly communicationsService: CommunicationsService) {}

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/communications/templates')
  async createTemplate(
    @Param('orgCode') orgCode: string,
    @Body() dto: CreateCommunicationTemplateDto,
    @Req() req: RequestWithAuth
  ) {
    return this.communicationsService.createTemplate({ orgCode, dto, req });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/communications/templates')
  async listTemplates(@Param('orgCode') orgCode: string, @Req() req: RequestWithAuth) {
    return this.communicationsService.listTemplates({ orgCode, req });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Patch('org/:orgCode/communications/templates/:templateId')
  async updateTemplate(
    @Param('orgCode') orgCode: string,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateCommunicationTemplateDto,
    @Req() req: RequestWithAuth
  ) {
    return this.communicationsService.updateTemplate({ orgCode, templateId, dto, req });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/communications/bulk-send')
  async bulkSend(
    @Param('orgCode') orgCode: string,
    @Body() dto: CreateBulkSendDto,
    @Req() req: RequestWithAuth
  ) {
    return this.communicationsService.bulkSend({ orgCode, dto, req });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/communications/logs')
  async listLogs(@Param('orgCode') orgCode: string, @Req() req: RequestWithAuth) {
    return this.communicationsService.listLogs({ orgCode, req });
  }
}
