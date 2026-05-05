import { Body, Controller, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import type { RequestWithAuth } from '../common/request-with-auth';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { OrgAccessGuard } from '../common/guards/org-access.guard';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { ActivateInviteDto } from './dto/activate-invite.dto';

@Controller()
export class OrganizationsController {
  constructor(
    @Inject(OrganizationsService) private readonly organizationsService: OrganizationsService
  ) {}

  @UseGuards(AccessTokenGuard, SuperAdminGuard)
  @Post('super-admin/organizations')
  async createOrganization(@Body() dto: CreateOrganizationDto, @Req() req: RequestWithAuth) {
    return this.organizationsService.createOrganization(dto, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Post('org/:orgCode/users/invite')
  async inviteUser(
    @Param('orgCode') orgCode: string,
    @Body() dto: InviteUserDto,
    @Req() req: RequestWithAuth
  ) {
    return this.organizationsService.inviteUser(orgCode, dto, req);
  }

  @Post('org/:orgCode/users/activate')
  async activateInvite(
    @Param('orgCode') orgCode: string,
    @Body() dto: ActivateInviteDto,
    @Req() req: RequestWithAuth
  ) {
    return this.organizationsService.activateInvite(orgCode, dto, req);
  }
}
