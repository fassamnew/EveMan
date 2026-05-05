import { Injectable } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import type { AuthContext } from './auth.types';

const POLICY_MATRIX: Record<RoleName, string[]> = {
  SUPER_ADMIN: ['org:create', 'org:invite', 'tenant:cross-access'],
  ORG_ADMIN: ['org:invite', 'tenant:scoped-access'],
  ORG_STAFF: ['tenant:scoped-access']
};

@Injectable()
export class PolicyService {
  hasRole(auth: AuthContext, role: RoleName): boolean {
    return auth.roles.includes(role);
  }

  canCreateOrganization(auth: AuthContext): boolean {
    return this.hasRole(auth, 'SUPER_ADMIN');
  }

  canInviteUsers(auth: AuthContext, targetOrgCode: string): boolean {
    if (this.hasRole(auth, 'SUPER_ADMIN')) {
      return true;
    }

    if (!this.hasRole(auth, 'ORG_ADMIN')) {
      return false;
    }

    return auth.organizationCode === targetOrgCode;
  }

  canAccessTenant(auth: AuthContext, targetOrgCode: string): boolean {
    if (this.hasRole(auth, 'SUPER_ADMIN')) {
      return true;
    }

    return auth.organizationCode === targetOrgCode;
  }

  getEffectivePermissions(auth: AuthContext): string[] {
    const merged = new Set<string>();

    for (const role of auth.roles) {
      const permissions = POLICY_MATRIX[role] || [];
      for (const perm of permissions) {
        merged.add(perm);
      }
    }

    return [...merged];
  }
}
