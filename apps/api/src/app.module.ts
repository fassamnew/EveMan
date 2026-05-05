import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { HealthController } from './health.controller';
import { getSystemQueue } from './infra/queue/queue.provider';
import { PrismaService } from './infra/db/prisma.service';
import { AuditService } from './modules/common/audit.service';
import { PasswordService } from './modules/common/password.service';
import { TokenService } from './modules/common/token.service';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { OrganizationsController } from './modules/organizations/organizations.controller';
import { OrganizationsService } from './modules/organizations/organizations.service';
import { AccessTokenGuard } from './modules/common/guards/access-token.guard';
import { SuperAdminGuard } from './modules/common/guards/super-admin.guard';
import { OrgAccessGuard } from './modules/common/guards/org-access.guard';
import { AuthRateLimitGuard } from './modules/common/guards/auth-rate-limit.guard';
import { tenantContextMiddleware } from './modules/common/tenant-context.middleware';
import { IdentityBootstrapService } from './modules/organizations/identity-bootstrap.service';

@Module({
  imports: [],
  controllers: [HealthController, AuthController, OrganizationsController],
  providers: [
    PrismaService,
    AuditService,
    PasswordService,
    TokenService,
    AuthService,
    OrganizationsService,
    AccessTokenGuard,
    SuperAdminGuard,
    OrgAccessGuard,
    AuthRateLimitGuard,
    IdentityBootstrapService
  ]
})
export class AppModule implements NestModule {
  onModuleInit() {
    // Queue bootstrap for background jobs; workers are added in later phases.
    getSystemQueue();
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(tenantContextMiddleware)
      .forRoutes({ path: 'org/:orgCode/*', method: RequestMethod.ALL });
  }
}
