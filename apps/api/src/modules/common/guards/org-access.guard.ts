import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestWithAuth } from '../request-with-auth';

@Injectable()
export class OrgAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithAuth>();
    const auth = req.auth;
    const tenantCode = req.params.orgCode || req.tenantCode;

    if (!auth) {
      throw new ForbiddenException('Missing auth context');
    }

    if (!tenantCode) {
      throw new ForbiddenException('Missing organization context');
    }

    if (auth.organizationCode !== tenantCode && !auth.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Cross-tenant access denied');
    }

    return true;
  }
}
