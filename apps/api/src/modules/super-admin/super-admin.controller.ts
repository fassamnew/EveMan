import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import type { RequestWithAuth } from '../common/request-with-auth';
import { SuperAdminService } from './super-admin.service';
import { UpdateOrganizationAdminDto } from './dto/update-organization-admin.dto';
import { UpdateSystemUserDto } from './dto/update-system-user.dto';
import { UpdateJsonSettingDto } from './dto/update-json-setting.dto';

@Controller('super-admin')
@UseGuards(AccessTokenGuard, SuperAdminGuard)
export class SuperAdminController {
  constructor(@Inject(SuperAdminService) private readonly superAdminService: SuperAdminService) {}

  @Get('platform/overview')
  async getPlatformOverview() {
    return this.superAdminService.getPlatformOverview();
  }

  @Get('platform/events')
  async listAllEvents() {
    return this.superAdminService.listAllEvents();
  }

  @Patch('organizations/:orgCode')
  async updateOrganization(
    @Param('orgCode') orgCode: string,
    @Body() dto: UpdateOrganizationAdminDto,
    @Req() req: RequestWithAuth
  ) {
    return this.superAdminService.updateOrganization(orgCode, dto, req);
  }

  @Get('system/users')
  async listSystemUsers() {
    return this.superAdminService.listSystemUsers();
  }

  @Patch('system/users/:userId')
  async updateSystemUser(
    @Param('userId') userId: string,
    @Body() dto: UpdateSystemUserDto,
    @Req() req: RequestWithAuth
  ) {
    return this.superAdminService.updateSystemUser(userId, dto.isActive, req);
  }

  @Get('system/audit-logs')
  async getAuditLogs(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.superAdminService.getAuditLogs(limit);
  }

  @Get('settings/subscription')
  async getSubscriptionConfig() {
    return this.superAdminService.getSubscriptionConfig();
  }

  @Put('settings/subscription')
  async updateSubscriptionConfig(@Body() dto: UpdateJsonSettingDto) {
    return this.superAdminService.updateSubscriptionConfig(dto.value);
  }

  @Get('settings/communications')
  async getCommunicationsConfig() {
    return this.superAdminService.getCommunicationsConfig();
  }

  @Put('settings/communications')
  async updateCommunicationsConfig(@Body() dto: UpdateJsonSettingDto) {
    return this.superAdminService.updateCommunicationsConfig(dto.value);
  }

  @Get('templates/badges/global')
  async getGlobalBadgeTemplates() {
    return this.superAdminService.getGlobalBadgeTemplates();
  }

  @Put('templates/badges/global')
  async updateGlobalBadgeTemplates(@Body() dto: UpdateJsonSettingDto) {
    return this.superAdminService.updateGlobalBadgeTemplates(dto.value);
  }

  @Get('templates/registration-pages/global')
  async getGlobalRegistrationTemplates() {
    return this.superAdminService.getGlobalRegistrationTemplates();
  }

  @Put('templates/registration-pages/global')
  async updateGlobalRegistrationTemplates(@Body() dto: UpdateJsonSettingDto) {
    return this.superAdminService.updateGlobalRegistrationTemplates(dto.value);
  }

  @Get('operations/backup-restore')
  async listBackupRestoreArtifacts() {
    return this.superAdminService.listBackupRestoreArtifacts();
  }
}
