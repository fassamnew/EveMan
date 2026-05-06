import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { OrgAccessGuard } from '../common/guards/org-access.guard';
import type { RequestWithAuth } from '../common/request-with-auth';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateLinkDto } from './dto/create-link.dto';
import { UpdateLinkDto } from './dto/update-link.dto';

@Controller()
export class EventsController {
  constructor(@Inject(EventsService) private readonly eventsService: EventsService) {}

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
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
  @Post('org/:orgCode/events/:eventId/archive')
  async archiveEvent(
    @Param('orgCode') orgCode: string,
    @Param('eventId') eventId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.eventsService.archiveEvent(orgCode, eventId, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
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

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
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

  @Get('public/o/:orgCode/events/:eventId/links/:slug')
  async getPublicMetadata(
    @Param('orgCode') orgCode: string,
    @Param('eventId') eventId: string,
    @Param('slug') slug: string
  ) {
    return this.eventsService.getPublicLinkMetadata(orgCode, eventId, slug);
  }
}
