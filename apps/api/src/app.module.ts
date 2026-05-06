import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { HealthController } from './health.controller';
import { getSystemQueue, startSystemWorker } from './infra/queue/queue.provider';
import { PrismaService } from './infra/db/prisma.service';
import { AuditService } from './modules/common/audit.service';
import { PasswordService } from './modules/common/password.service';
import { TokenService } from './modules/common/token.service';
import { PolicyService } from './modules/common/policy.service';
import { SecretsService } from './modules/common/secrets.service';
import { CaptchaService } from './modules/common/captcha.service';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { OrganizationsController } from './modules/organizations/organizations.controller';
import { OrganizationsService } from './modules/organizations/organizations.service';
import { EventsController } from './modules/events/events.controller';
import { EventsService } from './modules/events/events.service';
import { AccessTokenGuard } from './modules/common/guards/access-token.guard';
import { SuperAdminGuard } from './modules/common/guards/super-admin.guard';
import { OrgAccessGuard } from './modules/common/guards/org-access.guard';
import { AuthRateLimitGuard } from './modules/common/guards/auth-rate-limit.guard';
import { ManagementRateLimitGuard } from './modules/common/guards/management-rate-limit.guard';
import { PublicRegistrationRateLimitGuard } from './modules/common/guards/public-registration-rate-limit.guard';
import { tenantContextMiddleware } from './modules/common/tenant-context.middleware';
import { IdentityBootstrapService } from './modules/organizations/identity-bootstrap.service';
import { RegistrationsController } from './modules/registrations/registrations.controller';
import { RegistrationsService } from './modules/registrations/registrations.service';
import { BadgeQrController } from './modules/badges/badge-qr.controller';
import { BadgeQrService } from './modules/badges/badge-qr.service';

@Module({
  imports: [],
  controllers: [
    HealthController,
    AuthController,
    OrganizationsController,
    EventsController,
    RegistrationsController,
    BadgeQrController
  ],
  providers: [
    PrismaService,
    AuditService,
    SecretsService,
    CaptchaService,
    PolicyService,
    PasswordService,
    TokenService,
    AuthService,
    OrganizationsService,
    EventsService,
    RegistrationsService,
    BadgeQrService,
    AccessTokenGuard,
    SuperAdminGuard,
    OrgAccessGuard,
    AuthRateLimitGuard,
    ManagementRateLimitGuard,
    PublicRegistrationRateLimitGuard,
    IdentityBootstrapService
  ]
})
export class AppModule implements NestModule {
  onModuleInit() {
    // Queue bootstrap for background jobs; workers are added in later phases.
    getSystemQueue();
    startSystemWorker();
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(tenantContextMiddleware)
      .forRoutes({ path: 'org/:orgCode/*', method: RequestMethod.ALL });
  }
}
