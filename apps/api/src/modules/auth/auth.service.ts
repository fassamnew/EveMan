import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { AuditOutcome, RoleName } from '@prisma/client';
import { PrismaService } from '../../infra/db/prisma.service';
import { AuditService } from '../common/audit.service';
import { PasswordService } from '../common/password.service';
import { TokenService } from '../common/token.service';
import type { AuthContext } from '../common/auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RequestWithAuth } from '../common/request-with-auth';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  private getClientIp(req: RequestWithAuth): string | null {
    return req.ip || null;
  }

  private async markFailedLogin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { failedLoginCount: true }
    });

    if (!user) {
      return;
    }

    const nextCount = user.failedLoginCount + 1;
    const lockUntil =
      nextCount >= LOCKOUT_THRESHOLD
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
        : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: nextCount,
        lockedUntil: lockUntil
      }
    });
  }

  async unlockAccount(email: string): Promise<{ unlocked: true; email: string }> {
    const normalized = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email: normalized }, select: { id: true, email: true } });
    if (!user) throw new UnauthorizedException('User not found');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null }
    });
    return { unlocked: true, email: user.email };
  }

  private async clearLoginFailures(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date()
      }
    });
  }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }

  private toAuthContext(args: {
    userId: string;
    email: string;
    roles: RoleName[];
    organizationId: string | null;
    organizationCode: string | null;
  }): AuthContext {
    return {
      userId: args.userId,
      email: args.email,
      roles: args.roles,
      organizationId: args.organizationId,
      organizationCode: args.organizationCode
    };
  }

  async login(dto: LoginDto, req: RequestWithAuth) {
    const email = this.normalizeEmail(dto.email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: true,
            organization: true
          }
        }
      }
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException('Account is temporarily locked');
    }

    const validPassword = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!validPassword) {
      await this.markFailedLogin(user.id);
      await this.audit.write({
        actorUserId: user.id,
        action: 'AUTH_LOGIN',
        targetType: 'USER',
        targetId: user.id,
        outcome: AuditOutcome.FAILURE,
        ipAddress: this.getClientIp(req),
        metadataJson: { reason: 'INVALID_PASSWORD' }
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    let organizationId: string | null = null;
    let organizationCode: string | null = null;
    const requestedOrgId = dto.orgId?.trim() || null;
    const requestedOrgCode = dto.orgCode?.trim() || null;

    const superAdminAssignment = user.userRoles.find(item => item.role.name === 'SUPER_ADMIN');

    if (requestedOrgId || requestedOrgCode) {
      const assignment = user.userRoles.find(
        item =>
          item.organizationId !== null &&
          (!requestedOrgId || item.organizationId === requestedOrgId) &&
          (!requestedOrgCode || item.organization?.code === requestedOrgCode)
      );

      if (!assignment) {
        throw new UnauthorizedException('No access to requested organization');
      }

      organizationId = assignment.organizationId;
      organizationCode = assignment.organization?.code || null;
    } else if (!superAdminAssignment) {
      throw new BadRequestException('orgId is required for organization users');
    }

    const roleSet = new Set<RoleName>();
    for (const assignment of user.userRoles) {
      if (
        !organizationId ||
        assignment.organizationId === organizationId ||
        assignment.role.name === 'SUPER_ADMIN'
      ) {
        roleSet.add(assignment.role.name as RoleName);
      }
    }

    const authContext = this.toAuthContext({
      userId: user.id,
      email: user.email,
      roles: [...roleSet],
      organizationId,
      organizationCode
    });

    await this.clearLoginFailures(user.id);

    const accessToken = this.tokenService.signAccessToken(authContext);
    const refresh = this.tokenService.createRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        organizationId,
        tokenHash: refresh.tokenHash,
        expiresAt: refresh.expiresAt,
        createdByIp: this.getClientIp(req)
      }
    });

    await this.audit.write({
      actorUserId: user.id,
      organizationId,
      action: 'AUTH_LOGIN',
      targetType: 'USER',
      targetId: user.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req)
    });

    return {
      accessToken,
      refreshToken: refresh.token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: [...roleSet],
        organizationId,
        organizationCode
      }
    };
  }

  async refreshToken(rawRefreshToken: string, req: RequestWithAuth) {
    const tokenHash = this.tokenService.hashToken(rawRefreshToken);

    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            userRoles: {
              include: {
                role: true,
                organization: true
              }
            }
          }
        },
        organization: true
      }
    });

    if (!existing || existing.revokedAt || existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const roles = existing.user.userRoles
      .filter(item => {
        if (!existing.organizationId) {
          return item.role.name === 'SUPER_ADMIN';
        }
        return item.organizationId === existing.organizationId || item.role.name === 'SUPER_ADMIN';
      })
      .map(item => item.role.name as RoleName);

    const authContext = this.toAuthContext({
      userId: existing.user.id,
      email: existing.user.email,
      roles,
      organizationId: existing.organizationId,
      organizationCode: existing.organization?.code || null
    });

    const replacement = this.tokenService.createRefreshToken();

    const replacedToken = await this.prisma.refreshToken.create({
      data: {
        userId: existing.userId,
        organizationId: existing.organizationId,
        tokenHash: replacement.tokenHash,
        expiresAt: replacement.expiresAt,
        createdByIp: this.getClientIp(req)
      }
    });

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: {
        revokedAt: new Date(),
        replacedByTokenId: replacedToken.id,
        lastUsedAt: new Date(),
        lastUsedIp: this.getClientIp(req)
      }
    });

    await this.audit.write({
      actorUserId: existing.userId,
      organizationId: existing.organizationId,
      action: 'AUTH_REFRESH',
      targetType: 'REFRESH_TOKEN',
      targetId: existing.id,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req)
    });

    return {
      accessToken: this.tokenService.signAccessToken(authContext),
      refreshToken: replacement.token
    };
  }

  async logout(rawRefreshToken: string, req: RequestWithAuth): Promise<void> {
    const tokenHash = this.tokenService.hashToken(rawRefreshToken);

    const updated = await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null
      },
      data: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
        lastUsedIp: this.getClientIp(req)
      }
    });

    await this.audit.write({
      actorUserId: req.auth?.userId || null,
      organizationId: req.auth?.organizationId || null,
      action: 'AUTH_LOGOUT',
      targetType: 'REFRESH_TOKEN',
      targetId: null,
      outcome: updated.count > 0 ? AuditOutcome.SUCCESS : AuditOutcome.FAILURE,
      ipAddress: this.getClientIp(req)
    });
  }

  async initiatePasswordReset(emailInput: string, req: RequestWithAuth): Promise<void> {
    const email = this.normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email } });

    await this.audit.write({
      actorUserId: user?.id || null,
      organizationId: null,
      action: 'AUTH_PASSWORD_RESET_INITIATE',
      targetType: 'USER',
      targetId: user?.id || null,
      outcome: AuditOutcome.SUCCESS,
      ipAddress: this.getClientIp(req)
    });
  }
}
