import { Body, Controller, Get, Inject, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import type { RequestWithAuth } from '../common/request-with-auth';
import { CreateCheckinDto } from './dto/create-checkin.dto';
import { SearchAttendeesDto } from './dto/search-attendees.dto';
import { UsherService } from './usher.service';

@Controller('usher')
export class UsherController {
  constructor(@Inject(UsherService) private readonly usherService: UsherService) {}

  @UseGuards(AccessTokenGuard)
  @Get('assignments')
  async listAssignments(@Req() req: RequestWithAuth) {
    return this.usherService.listAssignments({ req });
  }

  @UseGuards(AccessTokenGuard)
  @Get('search')
  async searchAttendees(@Query() dto: SearchAttendeesDto, @Req() req: RequestWithAuth) {
    return this.usherService.searchAttendees({ dto, req });
  }

  @UseGuards(AccessTokenGuard)
  @Post('checkins')
  async createCheckin(@Body() dto: CreateCheckinDto, @Req() req: RequestWithAuth) {
    return this.usherService.createCheckin({ dto, req });
  }
}
