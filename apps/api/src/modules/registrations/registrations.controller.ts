import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PublicRegistrationRateLimitGuard } from '../common/guards/public-registration-rate-limit.guard';
import { SubmitRegistrationDto } from './dto/submit-registration.dto';
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

  @Get(':slug')
  async resolveLink(@Param('slug') slug: string) {
    return this.registrationsService.resolveLink(slug);
  }

  @Get(':slug/schema')
  async getSchema(@Param('slug') slug: string) {
    return this.registrationsService.getSchema(slug);
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
}
