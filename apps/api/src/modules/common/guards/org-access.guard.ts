import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { RequestWithAuth } from '../request-with-auth';
import { PolicyService } from '../policy.service';

@Injectable()
export class OrgAccessGuard implements CanActivate {
  constructor(@Inject(PolicyService) private readonly policy: PolicyService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithAuth>();
    const auth = req.auth;
    const routeOrgCode = req.params.orgCode;
    const tenantCode = typeof routeOrgCode === 'string' ? routeOrgCode : req.tenantCode;

    if (!auth) {
      throw new ForbiddenException('Missing auth context');
    }

    if (!tenantCode) {
      throw new ForbiddenException('Missing organization context');
    }

    if (!this.policy.canAccessTenant(auth, tenantCode)) {
      throw new ForbiddenException('Cross-tenant access denied');
    }

    return true;
  }
}
