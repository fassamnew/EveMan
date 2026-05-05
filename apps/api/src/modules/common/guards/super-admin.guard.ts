import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { SUPER_ADMIN_ROLE } from '../auth.types';
import type { RequestWithAuth } from '../request-with-auth';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithAuth>();
    const auth = req.auth;

    if (!auth) {
      throw new ForbiddenException('Missing auth context');
    }

    if (!auth.roles.includes(SUPER_ADMIN_ROLE)) {
      throw new ForbiddenException('Super Admin role required');
    }

    return true;
  }
}
