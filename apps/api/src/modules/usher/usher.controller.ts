import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import type { RequestWithAuth } from '../common/request-with-auth';
import { CreateCheckinDto } from './dto/create-checkin.dto';
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
  @Post('checkins')
  async createCheckin(@Body() dto: CreateCheckinDto, @Req() req: RequestWithAuth) {
    return this.usherService.createCheckin({ dto, req });
  }
}
