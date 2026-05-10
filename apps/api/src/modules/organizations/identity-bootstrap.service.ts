import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../../infra/db/prisma.service';
import { PasswordService } from '../common/password.service';

const SYSTEM_ROLES: Array<{ name: RoleName; description: string }> = [
  { name: 'SUPER_ADMIN', description: 'Platform super administrator' },
  { name: 'ORG_ADMIN', description: 'Organization administrator' },
  { name: 'ORG_STAFF', description: 'Organization staff member' }
];

@Injectable()
export class IdentityBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(IdentityBootstrapService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwordService: PasswordService
  ) {}

  async onModuleInit(): Promise<void> {
    for (const role of SYSTEM_ROLES) {
      // For system roles, organizationId should be null
      // We use upsertMany or individual upserts since the unique key is now (name, organizationId)
      const existing = await this.prisma.role.findFirst({
        where: {
          name: role.name,
          organizationId: null
        }
      });

      if (existing) {
        await this.prisma.role.update({
          where: { id: existing.id },
          data: {
            description: role.description,
            isSystem: true
          }
        });
      } else {
        await this.prisma.role.create({
          data: {
            name: role.name,
            description: role.description,
            isSystem: true,
            organizationId: null
          }
        });
      }
    }

    const superAdminEmail = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL;
    const superAdminPassword = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;

    if (!superAdminEmail || !superAdminPassword) {
      return;
    }

    const normalizedEmail = superAdminEmail.trim().toLowerCase();
    const hash = await this.passwordService.hash(superAdminPassword);

    const user = await this.prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        passwordHash: hash,
        isActive: true
      },
      create: {
        email: normalizedEmail,
        passwordHash: hash,
        isActive: true
      }
    });

    const superAdminRole = await this.prisma.role.findFirst({
      where: {
        name: 'SUPER_ADMIN',
        organizationId: null
      }
    });

    if (!superAdminRole) {
      return;
    }

    const existingRoleBinding = await this.prisma.userRole.findFirst({
      where: {
        userId: user.id,
        roleId: superAdminRole.id,
        organizationId: null
      }
    });

    if (!existingRoleBinding) {
      await this.prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: superAdminRole.id,
          organizationId: null
        }
      });
    }

    this.logger.log(`Bootstrapped Super Admin account for ${normalizedEmail}`);
  }
}
