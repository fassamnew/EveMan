import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import type { RequestWithAuth } from '../common/request-with-auth';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { OrgAccessGuard } from '../common/guards/org-access.guard';
import { ManagementRateLimitGuard } from '../common/guards/management-rate-limit.guard';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { ActivateInviteDto } from './dto/activate-invite.dto';
import { CreateLinkTypeDto } from './dto/create-link-type.dto';
import { UpdateLinkTypeDto } from './dto/update-link-type.dto';

@Controller()
export class OrganizationsController {
  constructor(
    @Inject(OrganizationsService) private readonly organizationsService: OrganizationsService
  ) {}

  @UseGuards(AccessTokenGuard, SuperAdminGuard)
  @Get('super-admin/organizations')
  async listOrganizations() {
    return this.organizationsService.listOrganizations();
  }

  @UseGuards(AccessTokenGuard, SuperAdminGuard)
  @Get('super-admin/organizations/:orgCode')
  async getOrganization(@Param('orgCode') orgCode: string) {
    return this.organizationsService.getOrganizationDetail(orgCode);
  }

  @UseGuards(AccessTokenGuard, SuperAdminGuard)
  @Post('super-admin/organizations/:orgCode/invite')
  async superAdminInviteUser(
    @Param('orgCode') orgCode: string,
    @Body() dto: InviteUserDto,
    @Req() req: RequestWithAuth
  ) {
    return this.organizationsService.inviteUser(orgCode, dto, req);
  }

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

  // ── Link Types ──────────────────────────────────────────────────────────

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/settings/link-types')
  async listLinkTypes(@Param('orgCode') orgCode: string, @Req() req: RequestWithAuth) {
    return this.organizationsService.listLinkTypes(orgCode, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/settings/link-types')
  async createLinkType(
    @Param('orgCode') orgCode: string,
    @Body() dto: CreateLinkTypeDto,
    @Req() req: RequestWithAuth
  ) {
    return this.organizationsService.createLinkType(orgCode, dto, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Patch('org/:orgCode/settings/link-types/:linkTypeId')
  async updateLinkType(
    @Param('orgCode') orgCode: string,
    @Param('linkTypeId') linkTypeId: string,
    @Body() dto: UpdateLinkTypeDto,
    @Req() req: RequestWithAuth
  ) {
    return this.organizationsService.updateLinkType(orgCode, linkTypeId, dto, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Delete('org/:orgCode/settings/link-types/:linkTypeId')
  async deleteLinkType(
    @Param('orgCode') orgCode: string,
    @Param('linkTypeId') linkTypeId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.organizationsService.deleteLinkType(orgCode, linkTypeId, req);
  }
}
