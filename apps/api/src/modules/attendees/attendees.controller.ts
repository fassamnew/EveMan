import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { OrgAccessGuard } from '../common/guards/org-access.guard';
import { ManagementRateLimitGuard } from '../common/guards/management-rate-limit.guard';
import type { RequestWithAuth } from '../common/request-with-auth';
import { AttendeesService } from './attendees.service';
import { ListAttendeesDto } from './dto/list-attendees.dto';
import { UpdateAttendeeDto } from './dto/update-attendee.dto';
import { ListAttendeeCommunicationsDto } from './dto/list-attendee-communications.dto';

@Controller()
export class AttendeesController {
  constructor(@Inject(AttendeesService) private readonly attendeesService: AttendeesService) {}

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/attendees')
  async list(
    @Param('orgCode') orgCode: string,
    @Query() dto: ListAttendeesDto,
    @Req() req: RequestWithAuth
  ) {
    return this.attendeesService.listAttendees({ orgCode, dto, req });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/attendees/:registrantId/communications')
  async listCommunications(
    @Param('orgCode') orgCode: string,
    @Param('registrantId') registrantId: string,
    @Query() dto: ListAttendeeCommunicationsDto,
    @Req() req: RequestWithAuth
  ) {
    return this.attendeesService.listAttendeeCommunications({ orgCode, registrantId, dto, req });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Patch('org/:orgCode/attendees/:registrantId')
  async update(
    @Param('orgCode') orgCode: string,
    @Param('registrantId') registrantId: string,
    @Body() dto: UpdateAttendeeDto,
    @Req() req: RequestWithAuth
  ) {
    return this.attendeesService.updateAttendee({ orgCode, registrantId, dto, req });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/attendees/:registrantId/approve')
  async approve(
    @Param('orgCode') orgCode: string,
    @Param('registrantId') registrantId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.attendeesService.approveAttendee({ orgCode, registrantId, req });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/attendees/:registrantId/reject')
  async reject(
    @Param('orgCode') orgCode: string,
    @Param('registrantId') registrantId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.attendeesService.rejectAttendee({ orgCode, registrantId, req });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/attendees/:registrantId/resend-badge')
  async resendBadge(
    @Param('orgCode') orgCode: string,
    @Param('registrantId') registrantId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.attendeesService.resendBadge({ orgCode, registrantId, req });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/attendees/:registrantId/check-in')
  async manualCheckIn(
    @Param('orgCode') orgCode: string,
    @Param('registrantId') registrantId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.attendeesService.manualCheckIn({ orgCode, registrantId, req });
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/attendees/:registrantId/cancel')
  async cancelRegistration(
    @Param('orgCode') orgCode: string,
    @Param('registrantId') registrantId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.attendeesService.cancelRegistration({ orgCode, registrantId, req });
  }
}
