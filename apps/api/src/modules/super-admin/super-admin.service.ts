import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditOutcome } from '@prisma/client';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PrismaService } from '../../infra/db/prisma.service';
import { AuditService } from '../common/audit.service';
import type { RequestWithAuth } from '../common/request-with-auth';

const SETTING_KEYS = {
  subscription: 'super-admin:subscription-config',
  communications: 'super-admin:communications-config',
  globalBadgeTemplates: 'super-admin:global-badge-templates',
  globalRegistrationTemplates: 'super-admin:global-registration-page-templates'
} as const;

@Injectable()
export class SuperAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  private getClientIp(req: RequestWithAuth): string | null {
    return req.ip || null;
  }

  private async getJsonSetting<T extends Record<string, unknown>>(key: string, fallback: T): Promise<T> {
    const record = await this.prisma.migrationMetadata.findUnique({ where: { key } });
    if (!record) {
      return fallback;
    }

    try {
      const parsed = JSON.parse(record.value) as T;
      return parsed;
    } catch {
      return fallback;
    }
  }

  private async setJsonSetting(key: string, value: Record<string, unknown>): Promise<void> {
    await this.prisma.migrationMetadata.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value) }
    });
  }

  async getPlatformOverview() {
    const [organizations, activeOrganizations, users, activeUsers, events, auditLogCount] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { isActive: true } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.event.count(),
      this.prisma.auditLog.count()
    ]);

    return {
      organizations,
      activeOrganizations,
      users,
      activeUsers,
      events,
      auditLogCount
    };
  }

  async listAllEvents() {
    return this.prisma.event.findMany({
      include: {
        organization: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateOrganization(orgCode: string, input: { name?: string; isActive?: boolean; code?: string }, req: RequestWithAuth) {
    const org = await this.prisma.organization.findUnique({ where: { code: orgCode } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const updated = await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        name: input.name,
        isActive: input.isActive,
        code: input.code
      }
    });

    await this.audit.write({
      actorUserId: req.auth?.userId || null,
      organizationId: updated.id,
      action: 'ORG_UPDATE',
      targetType: 'ORGANIZATION',
      targetId: updated.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req),
      metadataJson: {
        previousCode: org.code,
        updates: {
          name: input.name,
          isActive: input.isActive,
          code: input.code
        }
      }
    });

    return updated;
  }

  async listSystemUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: {
          select: {
            role: { select: { name: true } },
            organization: { select: { id: true, code: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateSystemUser(userId: string, isActive: boolean, req: RequestWithAuth) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive }
    });

    await this.audit.write({
      actorUserId: req.auth?.userId || null,
      organizationId: null,
      action: 'USER_STATUS_UPDATE',
      targetType: 'USER',
      targetId: userId,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req),
      metadataJson: {
        email: user.email,
        isActive
      }
    });

    return updated;
  }

  async getAuditLogs(limit = 100) {
    const cappedLimit = Math.max(1, Math.min(limit, 500));
    return this.prisma.auditLog.findMany({
      include: {
        actorUser: { select: { id: true, email: true } },
        organization: { select: { id: true, code: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: cappedLimit
    });
  }

  async getSubscriptionConfig() {
    return this.getJsonSetting(SETTING_KEYS.subscription, {
      plans: [],
      defaultPlan: null
    });
  }

  async updateSubscriptionConfig(value: Record<string, unknown>) {
    await this.setJsonSetting(SETTING_KEYS.subscription, value);
    return this.getSubscriptionConfig();
  }

  async getCommunicationsConfig() {
    return this.getJsonSetting(SETTING_KEYS.communications, {
      emailProvider: null,
      smsProvider: null,
      senderName: null,
      senderEmail: null
    });
  }

  async updateCommunicationsConfig(value: Record<string, unknown>) {
    await this.setJsonSetting(SETTING_KEYS.communications, value);
    return this.getCommunicationsConfig();
  }

  async getGlobalBadgeTemplates() {
    return this.getJsonSetting(SETTING_KEYS.globalBadgeTemplates, {
      templates: []
    });
  }

  async updateGlobalBadgeTemplates(value: Record<string, unknown>) {
    await this.setJsonSetting(SETTING_KEYS.globalBadgeTemplates, value);
    return this.getGlobalBadgeTemplates();
  }

  async getGlobalRegistrationTemplates() {
    return this.getJsonSetting(SETTING_KEYS.globalRegistrationTemplates, {
      templates: []
    });
  }

  async updateGlobalRegistrationTemplates(value: Record<string, unknown>) {
    await this.setJsonSetting(SETTING_KEYS.globalRegistrationTemplates, value);
    return this.getGlobalRegistrationTemplates();
  }

  async listBackupRestoreArtifacts() {
    const candidateDirs = [
      path.resolve(process.cwd(), 'artifacts/phase8'),
      path.resolve(process.cwd(), '../../artifacts/phase8')
    ];

    for (const dir of candidateDirs) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const reports = entries
          .filter(item => item.isFile())
          .map(item => item.name)
          .filter(name =>
            name.startsWith('backup-restore-report-') ||
            name.startsWith('mysql-backup-')
          )
          .sort()
          .reverse();

        return {
          directory: dir,
          reports
        };
      } catch {
        // Try next candidate.
      }
    }

    return {
      directory: null,
      reports: []
    };
  }
}
