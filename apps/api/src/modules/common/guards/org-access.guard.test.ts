import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { OrgAccessGuard } from './org-access.guard';

function createContext(req: any): any {
  return {
    switchToHttp: () => ({
      getRequest: () => req
    })
  };
}

describe('OrgAccessGuard', () => {
  it('allows matching org context', () => {
    const guard = new OrgAccessGuard();
    const allowed = guard.canActivate(
      createContext({
        params: { orgCode: 'acme' },
        auth: {
          organizationCode: 'acme',
          roles: ['ORG_ADMIN']
        }
      })
    );

    expect(allowed).toBe(true);
  });

  it('allows super admin cross-tenant access', () => {
    const guard = new OrgAccessGuard();
    const allowed = guard.canActivate(
      createContext({
        params: { orgCode: 'acme' },
        auth: {
          organizationCode: null,
          roles: ['SUPER_ADMIN']
        }
      })
    );

    expect(allowed).toBe(true);
  });

  it('blocks cross-tenant access for non-super-admin', () => {
    const guard = new OrgAccessGuard();

    expect(() =>
      guard.canActivate(
        createContext({
          params: { orgCode: 'acme' },
          auth: {
            organizationCode: 'other-org',
            roles: ['ORG_STAFF']
          }
        })
      )
    ).toThrow(ForbiddenException);
  });
});
