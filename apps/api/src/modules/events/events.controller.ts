import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { OrgAccessGuard } from '../common/guards/org-access.guard';
import { ManagementRateLimitGuard } from '../common/guards/management-rate-limit.guard';
import type { RequestWithAuth } from '../common/request-with-auth';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateLinkDto } from './dto/create-link.dto';
import { UpdateLinkDto } from './dto/update-link.dto';
import { UpdateLinkFormFieldsDto } from './dto/update-link-form-fields.dto';
import { CreateEventTemplateDto } from './dto/create-event-template.dto';
import { ApplyEventTemplateDto } from './dto/apply-event-template.dto';
import { UpdateLinkApprovalRulesDto } from './dto/update-link-approval-rules.dto';
import { UpdateEventSettingsDto } from './dto/update-event-settings.dto';
import { UpdateLinkSettingsDto } from './dto/update-link-settings.dto';

@Controller()
export class EventsController {
  constructor(@Inject(EventsService) private readonly eventsService: EventsService) {}

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/events')
  async createEvent(
    @Param('orgCode') orgCode: string,
    @Body() dto: CreateEventDto,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.createEvent(orgCode, dto, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/events')
  async listEvents(@Param('orgCode') orgCode: string, @Req() req: RequestWithAuth) {
    return this.eventsService.listEvents(orgCode, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/event-templates')
  async listEventTemplates(@Param('orgCode') orgCode: string, @Req() req: RequestWithAuth) {
    return this.eventsService.listEventTemplates(orgCode, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/event-templates')
  async createEventTemplate(
    @Param('orgCode') orgCode: string,
    @Body() dto: CreateEventTemplateDto,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.createEventTemplate(orgCode, dto, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Delete('org/:orgCode/event-templates/:templateId')
  async deleteEventTemplate(
    @Param('orgCode') orgCode: string,
    @Param('templateId') templateId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.deleteEventTemplate(orgCode, templateId, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/event-templates/:templateId/apply')
  async applyEventTemplate(
    @Param('orgCode') orgCode: string,
    @Param('templateId') templateId: string,
    @Body() dto: ApplyEventTemplateDto,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.applyEventTemplate(orgCode, templateId, dto, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Patch('org/:orgCode/events/:eventId')
  async updateEvent(
    @Param('orgCode') orgCode: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventDto,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.updateEvent(orgCode, eventId, dto, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/events/:eventId/settings')
  async getEventSettings(
    @Param('orgCode') orgCode: string,
    @Param('eventId') eventId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.getEventSettings(orgCode, eventId, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Patch('org/:orgCode/events/:eventId/settings')
  async updateEventSettings(
    @Param('orgCode') orgCode: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventSettingsDto,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.updateEventSettings(orgCode, eventId, dto, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/events/:eventId/archive')
  async archiveEvent(
    @Param('orgCode') orgCode: string,
    @Param('eventId') eventId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.archiveEvent(orgCode, eventId, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/events/:eventId/links')
  async createLink(
    @Param('orgCode') orgCode: string,
    @Param('eventId') eventId: string,
    @Body() dto: CreateLinkDto,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.createLink(orgCode, eventId, dto, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/events/:eventId/links')
  async listLinks(
    @Param('orgCode') orgCode: string,
    @Param('eventId') eventId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.listLinks(orgCode, eventId, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Patch('org/:orgCode/events/:eventId/links/:linkId')
  async updateLink(
    @Param('orgCode') orgCode: string,
    @Param('eventId') eventId: string,
    @Param('linkId') linkId: string,
    @Body() dto: UpdateLinkDto,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.updateLink(orgCode, eventId, linkId, dto, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/events/:eventId/links/:linkId/settings')
  async getLinkSettings(
    @Param('orgCode') orgCode: string,
    @Param('eventId') eventId: string,
    @Param('linkId') linkId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.getLinkSettings(orgCode, eventId, linkId, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Patch('org/:orgCode/events/:eventId/links/:linkId/settings')
  async updateLinkSettings(
    @Param('orgCode') orgCode: string,
    @Param('eventId') eventId: string,
    @Param('linkId') linkId: string,
    @Body() dto: UpdateLinkSettingsDto,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.updateLinkSettings(orgCode, eventId, linkId, dto, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Delete('org/:orgCode/events/:eventId/links/:linkId')
  async deleteLink(
    @Param('orgCode') orgCode: string,
    @Param('eventId') eventId: string,
    @Param('linkId') linkId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.deleteLink(orgCode, eventId, linkId, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/events/:eventId/links/:linkId/form-fields')
  async listLinkFormFields(
    @Param('orgCode') orgCode: string,
    @Param('eventId') eventId: string,
    @Param('linkId') linkId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.listLinkFormFields(orgCode, eventId, linkId, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Patch('org/:orgCode/events/:eventId/links/:linkId/form-fields')
  async updateLinkFormFields(
    @Param('orgCode') orgCode: string,
    @Param('eventId') eventId: string,
    @Param('linkId') linkId: string,
    @Body() dto: UpdateLinkFormFieldsDto,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.updateLinkFormFields(orgCode, eventId, linkId, dto, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/events/:eventId/links/:linkId/approval-rules')
  async listLinkApprovalRules(
    @Param('orgCode') orgCode: string,
    @Param('eventId') eventId: string,
    @Param('linkId') linkId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.listLinkApprovalRules(orgCode, eventId, linkId, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Patch('org/:orgCode/events/:eventId/links/:linkId/approval-rules')
  async updateLinkApprovalRules(
    @Param('orgCode') orgCode: string,
    @Param('eventId') eventId: string,
    @Param('linkId') linkId: string,
    @Body() dto: UpdateLinkApprovalRulesDto,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.updateLinkApprovalRules(orgCode, eventId, linkId, dto, req);
  }

  @Get('public/o/:orgCode/events/:eventId/links/:slug')
  async getPublicMetadata(
    @Param('orgCode') orgCode: string,
    @Param('eventId') eventId: string,
    @Param('slug') slug: string
  ) {
    return this.eventsService.getPublicLinkMetadata(orgCode, eventId, slug);
  }
}
