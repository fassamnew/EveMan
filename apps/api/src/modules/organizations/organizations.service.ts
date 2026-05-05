import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AuditOutcome, RoleName } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../infra/db/prisma.service';
import { AuditService } from '../common/audit.service';
import { TokenService } from '../common/token.service';
import { PasswordService } from '../common/password.service';
import type { RequestWithAuth } from '../common/request-with-auth';
import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { InviteUserDto } from './dto/invite-user.dto';
import type { ActivateInviteDto } from './dto/activate-invite.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tokenService: TokenService,
    private readonly passwordService: PasswordService
  ) {}

  private getClientIp(req: RequestWithAuth): string | null {
    return req.ip || null;
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

    const canInvite = req.auth.roles.includes('ORG_ADMIN') || req.auth.roles.includes('SUPER_ADMIN');
    if (!canInvite) {
      throw new ForbiddenException('ORG_ADMIN role required to invite users');
    }

    const role = await this.prisma.role.findUnique({
      where: { name: dto.roleName as RoleName }
    });

    if (!role) {
      throw new BadRequestException('Invalid role');
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
        roleName: dto.roleName
      }
    });

    return {
      organizationCode: orgCode,
      email: dto.email,
      roleName: dto.roleName,
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
}
