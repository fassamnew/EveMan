import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PublicRegistrationRateLimitGuard } from '../common/guards/public-registration-rate-limit.guard';
import { SubmitRegistrationDto } from './dto/submit-registration.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';
import { RegistrationsService } from './registrations.service';

@Controller('public/register')
export class RegistrationsController {
  constructor(@Inject(RegistrationsService) private readonly registrationsService: RegistrationsService) {}

  @Get('lookup')
  async retrieve(
    @Query('referenceCode') referenceCode: string,
    @Query('email') email: string
  ) {
    return this.registrationsService.retrieve(referenceCode, email);
  }

  @Get('badge')
  async getBadge(
    @Query('referenceCode') referenceCode: string,
    @Query('email') email: string
  ) {
    return this.registrationsService.getBadge(referenceCode, email);
  }

  @Get(':slug')
  async resolveLink(
    @Param('slug') slug: string,
    @Query('accessPassword') accessPassword?: string,
    @Query('inviteToken') inviteToken?: string
  ) {
    return this.registrationsService.resolveLink(slug, {
      accessPassword,
      inviteToken
    });
  }

  @Get(':slug/schema')
  async getSchema(
    @Param('slug') slug: string,
    @Query('accessPassword') accessPassword?: string,
    @Query('inviteToken') inviteToken?: string
  ) {
    return this.registrationsService.getSchema(slug, {
      accessPassword,
      inviteToken
    });
  }

  @UseGuards(PublicRegistrationRateLimitGuard)
  @Post(':slug/submissions')
  async submit(
    @Param('slug') slug: string,
    @Body() dto: SubmitRegistrationDto,
    @Req() req: Request
  ) {
    return this.registrationsService.submit(slug, dto, req);
  }

  @UseGuards(PublicRegistrationRateLimitGuard)
  @Patch(':slug/submissions/:referenceCode')
  async updateSubmission(
    @Param('slug') slug: string,
    @Param('referenceCode') referenceCode: string,
    @Body() dto: UpdateRegistrationDto,
    @Req() req: Request
  ) {
    return this.registrationsService.updateSubmission(slug, referenceCode, dto, req);
  }
}
