import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AuditOutcome, RoleName } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../infra/db/prisma.service';
import { AuditService } from '../common/audit.service';
import { TokenService } from '../common/token.service';
import { PasswordService } from '../common/password.service';
import { PolicyService } from '../common/policy.service';
import type { RequestWithAuth } from '../common/request-with-auth';
import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { InviteUserDto } from './dto/invite-user.dto';
import type { ActivateInviteDto } from './dto/activate-invite.dto';
import type { CreateLinkTypeDto } from './dto/create-link-type.dto';
import type { UpdateLinkTypeDto } from './dto/update-link-type.dto';
import type { CreateCustomRoleDto } from './dto/create-custom-role.dto';
import type { UpdateCustomRoleDto } from './dto/update-custom-role.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(PolicyService) private readonly policy: PolicyService
  ) {}

  private getClientIp(req: RequestWithAuth): string | null {
    return req.ip || null;
  }

  async listOrganizations() {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async getOrganizationDetail(orgCode: string) {
    const org = await this.prisma.organization.findUnique({
      where: { code: orgCode },
      include: {
        userRoles: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true, lastLoginAt: true } },
            role: { select: { name: true } }
          },
          orderBy: { createdAt: 'asc' }
        },
        invites: {
          where: { acceptedAt: null, expiresAt: { gt: new Date() } },
          select: { id: true, email: true, expiresAt: true, createdAt: true, role: { select: { name: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async createOrganization(dto: CreateOrganizationDto, req: RequestWithAuth) {
    const created = await this.prisma.organization.create({
      data: {
        name: dto.name,
        code: dto.code
      }
    });

    await this.audit.write({
      actorUserId: req.auth?.userId || null,
      organizationId: created.id,
      action: 'ORG_CREATE',
      targetType: 'ORGANIZATION',
      targetId: created.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req)
    });

    return created;
  }

  async inviteUser(orgCode: string, dto: InviteUserDto, req: RequestWithAuth) {
    const org = await this.prisma.organization.findUnique({ where: { code: orgCode } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (!req.auth?.userId) {
      throw new ForbiddenException('Authenticated user required');
    }

    const canInvite = this.policy.canInviteUsers(req.auth, orgCode);
    if (!canInvite) {
      throw new ForbiddenException('ORG_ADMIN role required to invite users');
    }

    let role;

    // Support both roleId and roleName for backward compatibility
    if (dto.roleId) {
      role = await this.prisma.role.findUnique({
        where: { id: dto.roleId }
      });

      // Ensure role belongs to org or is a system role
      if (!role || (role.organizationId && role.organizationId !== org.id)) {
        throw new BadRequestException('Role not found or not available for this organization');
      }
    } else if (dto.roleName) {
      role = await this.prisma.role.findFirst({
        where: {
          name: dto.roleName,
          isSystem: true,
          organizationId: null
        }
      });

      if (!role) {
        throw new BadRequestException('Invalid role');
      }
    } else {
      throw new BadRequestException('Either roleId or roleName must be provided');
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.tokenService.hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.invite.create({
      data: {
        organizationId: org.id,
        email: dto.email.trim().toLowerCase(),
        roleId: role.id,
        tokenHash,
        expiresAt,
        invitedByUserId: req.auth.userId
      }
    });

    await this.audit.write({
      actorUserId: req.auth.userId,
      organizationId: org.id,
      action: 'USER_INVITE_CREATE',
      targetType: 'INVITE',
      targetId: null,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req),
      metadataJson: {
        email: dto.email,
        roleName: dto.roleName,
        roleId: dto.roleId
      }
    });

    return {
      organizationCode: orgCode,
      email: dto.email,
      roleName: role.name,
      roleId: role.id,
      inviteToken: token,
      expiresAt
    };
  }

  async activateInvite(orgCode: string, dto: ActivateInviteDto, req: RequestWithAuth) {
    const org = await this.prisma.organization.findUnique({ where: { code: orgCode } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const tokenHash = this.tokenService.hashToken(dto.token);

    const invite = await this.prisma.invite.findUnique({
      where: { tokenHash },
      include: { role: true }
    });

    if (!invite || invite.organizationId !== org.id) {
      throw new BadRequestException('Invalid invite token');
    }

    if (invite.acceptedAt) {
      throw new BadRequestException('Invite already used');
    }

    if (invite.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Invite expired');
    }

    const email = invite.email.trim().toLowerCase();
    const passwordHash = await this.passwordService.hash(dto.password);

    const user = await this.prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isActive: true
      },
      create: {
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isActive: true
      }
    });

    await this.prisma.$transaction([
      this.prisma.userRole.upsert({
        where: {
          userId_roleId_organizationId: {
            userId: user.id,
            roleId: invite.roleId,
            organizationId: org.id
          }
        },
        update: {},
        create: {
          userId: user.id,
          roleId: invite.roleId,
          organizationId: org.id
        }
      }),
      this.prisma.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() }
      })
    ]);

    await this.audit.write({
      actorUserId: user.id,
      organizationId: org.id,
      action: 'USER_INVITE_ACCEPT',
      targetType: 'INVITE',
      targetId: invite.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req)
    });

    return {
      activated: true,
      userId: user.id,
      organizationCode: org.code
    };
  }

  // ── Link Types ────────────────────────────────────────────────────────────

  private assertOrgAdminAccess(orgCode: string, req: RequestWithAuth): void {
    if (!req.auth || !this.policy.canManageEventSettings(req.auth, orgCode)) {
      throw new ForbiddenException('ORG_ADMIN role required');
    }
  }

  private async getOrgByCode(orgCode: string) {
    const org = await this.prisma.organization.findUnique({ where: { code: orgCode } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async listLinkTypes(orgCode: string, req: RequestWithAuth) {
    if (!req.auth || !this.policy.canAccessTenant(req.auth, orgCode)) {
      throw new ForbiddenException('Missing tenant access');
    }
    const org = await this.getOrgByCode(orgCode);
    return this.prisma.linkType.findMany({
      where: { organizationId: org.id, isActive: true },
      orderBy: { name: 'asc' }
    });
  }

  async createLinkType(orgCode: string, dto: CreateLinkTypeDto, req: RequestWithAuth) {
    this.assertOrgAdminAccess(orgCode, req);
    const org = await this.getOrgByCode(orgCode);
    try {
      return await this.prisma.linkType.create({
        data: {
          organizationId: org.id,
          name: dto.name.trim(),
          color: dto.color ?? '#6366f1'
        }
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002') {
        throw new BadRequestException('A link type with that name already exists');
      }
      throw err;
    }
  }

  async updateLinkType(orgCode: string, linkTypeId: string, dto: UpdateLinkTypeDto, req: RequestWithAuth) {
    this.assertOrgAdminAccess(orgCode, req);
    const org = await this.getOrgByCode(orgCode);
    const existing = await this.prisma.linkType.findFirst({
      where: { id: linkTypeId, organizationId: org.id }
    });
    if (!existing) throw new NotFoundException('Link type not found');
    try {
      return await this.prisma.linkType.update({
        where: { id: linkTypeId },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          color: dto.color,
          isActive: dto.isActive
        }
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002') {
        throw new BadRequestException('A link type with that name already exists');
      }
      throw err;
    }
  }

  async deleteLinkType(orgCode: string, linkTypeId: string, req: RequestWithAuth) {
    this.assertOrgAdminAccess(orgCode, req);
    const org = await this.getOrgByCode(orgCode);
    const existing = await this.prisma.linkType.findFirst({
      where: { id: linkTypeId, organizationId: org.id }
    });
    if (!existing) throw new NotFoundException('Link type not found');
    await this.prisma.linkType.update({
      where: { id: linkTypeId },
      data: { isActive: false }
    });
    return { id: linkTypeId, deleted: true };
  }

  // ── Custom Roles ────────────────────────────────────────────────────────────

  async listRoles(orgCode: string, req: RequestWithAuth) {
    if (!req.auth || !this.policy.canAccessTenant(req.auth, orgCode)) {
      throw new ForbiddenException('Missing tenant access');
    }
    const org = await this.getOrgByCode(orgCode);

    // Return system roles + org-scoped custom roles
    const roles = await this.prisma.role.findMany({
      where: {
        OR: [
          { isSystem: true, organizationId: null }, // System roles
          { organizationId: org.id } // Org-scoped custom roles
        ]
      },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        createdAt: true
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }]
    });

    return roles;
  }

  async createRole(orgCode: string, dto: CreateCustomRoleDto, req: RequestWithAuth) {
    this.assertOrgAdminAccess(orgCode, req);
    const org = await this.getOrgByCode(orgCode);

    // Check if role name already exists for this org
    const existing = await this.prisma.role.findFirst({
      where: { name: dto.name.trim(), organizationId: org.id }
    });

    if (existing) {
      throw new BadRequestException('A role with that name already exists in this organization');
    }

    const role = await this.prisma.role.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        isSystem: false,
        organizationId: org.id
      },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        createdAt: true
      }
    });

    await this.audit.write({
      actorUserId: req.auth?.userId,
      organizationId: org.id,
      action: 'ROLE_CREATED',
      targetType: 'ROLE',
      targetId: role.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req),
      metadataJson: { roleName: role.name }
    });

    return role;
  }

  async updateRole(orgCode: string, roleId: string, dto: UpdateCustomRoleDto, req: RequestWithAuth) {
    this.assertOrgAdminAccess(orgCode, req);
    const org = await this.getOrgByCode(orgCode);

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId: org.id }
    });

    if (!role) throw new NotFoundException('Role not found');

    if (role.isSystem) {
      throw new ForbiddenException('Cannot modify system roles');
    }

    const updated = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        description: dto.description !== undefined ? dto.description.trim() : undefined
      },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        createdAt: true
      }
    });

    await this.audit.write({
      actorUserId: req.auth?.userId,
      organizationId: org.id,
      action: 'ROLE_UPDATED',
      targetType: 'ROLE',
      targetId: roleId,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req)
    });

    return updated;
  }

  async deleteRole(orgCode: string, roleId: string, req: RequestWithAuth) {
    this.assertOrgAdminAccess(orgCode, req);
    const org = await this.getOrgByCode(orgCode);

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId: org.id }
    });

    if (!role) throw new NotFoundException('Role not found');

    if (role.isSystem) {
      throw new ForbiddenException('Cannot delete system roles');
    }

    // Check if role is in use
    const usersWithRole = await this.prisma.userRole.count({
      where: { roleId }
    });

    if (usersWithRole > 0) {
      throw new BadRequestException(`Cannot delete role: ${usersWithRole} user(s) are assigned to this role`);
    }

    const pendingInvites = await this.prisma.invite.count({
      where: { roleId }
    });

    if (pendingInvites > 0) {
      throw new BadRequestException(`Cannot delete role: ${pendingInvites} pending invite(s) use this role`);
    }

    await this.prisma.role.delete({ where: { id: roleId } });

    await this.audit.write({
      actorUserId: req.auth?.userId,
      organizationId: org.id,
      action: 'ROLE_DELETED',
      targetType: 'ROLE',
      targetId: roleId,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req),
      metadataJson: { roleName: role.name }
    });

    return { id: roleId, deleted: true };
  }
}

