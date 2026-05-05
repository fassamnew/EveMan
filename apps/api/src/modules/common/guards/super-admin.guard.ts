import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { RequestWithAuth } from '../request-with-auth';
import { PolicyService } from '../policy.service';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(@Inject(PolicyService) private readonly policy: PolicyService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithAuth>();
    const auth = req.auth;

    if (!auth) {
      throw new ForbiddenException('Missing auth context');
    }

    if (!this.policy.canCreateOrganization(auth)) {
      throw new ForbiddenException('Super Admin role required');
    }

    return true;
  }
}
