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
import { CreateCustomRoleDto } from './dto/create-custom-role.dto';
import { UpdateCustomRoleDto } from './dto/update-custom-role.dto';
import { BulkInviteUsersDto } from './dto/bulk-invite-users.dto';
import { UpsertWebhookConfigDto } from './dto/upsert-webhook-config.dto';

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

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Post('org/:orgCode/users/invite/bulk')
  async bulkInviteUsers(
    @Param('orgCode') orgCode: string,
    @Body() dto: BulkInviteUsersDto,
    @Req() req: RequestWithAuth
  ) {
    return this.organizationsService.bulkInviteUsers(orgCode, dto, req);
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

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/settings/webhooks')
  async listWebhooks(@Param('orgCode') orgCode: string, @Req() req: RequestWithAuth) {
    return this.organizationsService.listWebhooks(orgCode, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/settings/webhooks')
  async createWebhook(
    @Param('orgCode') orgCode: string,
    @Body() dto: UpsertWebhookConfigDto,
    @Req() req: RequestWithAuth
  ) {
    return this.organizationsService.createWebhook(orgCode, dto, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Patch('org/:orgCode/settings/webhooks/:webhookId')
  async updateWebhook(
    @Param('orgCode') orgCode: string,
    @Param('webhookId') webhookId: string,
    @Body() dto: UpsertWebhookConfigDto,
    @Req() req: RequestWithAuth
  ) {
    return this.organizationsService.updateWebhook(orgCode, webhookId, dto, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Delete('org/:orgCode/settings/webhooks/:webhookId')
  async deleteWebhook(
    @Param('orgCode') orgCode: string,
    @Param('webhookId') webhookId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.organizationsService.deleteWebhook(orgCode, webhookId, req);
  }

  // ── Custom Roles ────────────────────────────────────────────────────────────

  @UseGuards(AccessTokenGuard, OrgAccessGuard)
  @Get('org/:orgCode/roles')
  async listRoles(@Param('orgCode') orgCode: string, @Req() req: RequestWithAuth) {
    return this.organizationsService.listRoles(orgCode, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Post('org/:orgCode/roles')
  async createRole(
    @Param('orgCode') orgCode: string,
    @Body() dto: CreateCustomRoleDto,
    @Req() req: RequestWithAuth
  ) {
    return this.organizationsService.createRole(orgCode, dto, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Patch('org/:orgCode/roles/:roleId')
  async updateRole(
    @Param('orgCode') orgCode: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateCustomRoleDto,
    @Req() req: RequestWithAuth
  ) {
    return this.organizationsService.updateRole(orgCode, roleId, dto, req);
  }

  @UseGuards(AccessTokenGuard, OrgAccessGuard, ManagementRateLimitGuard)
  @Delete('org/:orgCode/roles/:roleId')
  async deleteRole(
    @Param('orgCode') orgCode: string,
    @Param('roleId') roleId: string,
    @Req() req: RequestWithAuth
  ) {
    return this.organizationsService.deleteRole(orgCode, roleId, req);
  }
}
