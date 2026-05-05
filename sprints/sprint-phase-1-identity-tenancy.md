# Sprint: Phase 1 Identity and Tenancy Core

## Duration

2 weeks

## Objective

Implement secure authentication, authorization, and organization boundaries as the foundation for all multi-tenant features.

## Scope

1. Organizations, users, roles, and user-role mappings.
2. Login, refresh token rotation, logout, password reset initiation.
3. Tenant-aware authorization guards.
4. Audit logs for auth and role changes.

## Non-Goals

1. Event and registration business logic.
2. Public registrant flows.

## Backlog

1. Create MySQL tables for organizations, users, roles, user_roles, refresh_tokens, invites.
2. Implement organization creation service for Super Admin only.
3. Implement user invitation and onboarding flow.
4. Implement login endpoint with Argon2id verification.
5. Implement access token and refresh token rotation.
6. Implement account lockout policy and failed login tracking.
7. Implement logout and token revocation.
8. Implement RBAC guards and policy helpers.
9. Implement tenant context middleware.
10. Add auth and access audit logging.
11. Implement frontend login and session handling.

## Security and Compliance Requirements

1. Passwords hashed with Argon2id only.
2. Refresh tokens stored as hashes only.
3. JWT keys loaded from secrets manager in non-local environments.
4. Rate limiting on auth endpoints.

## Data Model and API Impacts

1. New /auth endpoints for login, refresh, logout.
2. New /super-admin/organizations endpoints.
3. New /organizations/:id/users invitation endpoints.

## Testing Plan

1. Unit tests for auth service and policy checks.
2. Integration tests for token lifecycle.
3. Negative tests for cross-tenant access attempts.
4. Brute-force protection tests for lockout policy.

## Acceptance Criteria

1. Super Admin can create organizations.
2. Invited user can activate account and log in.
3. Tenant isolation blocks cross-org data access.
4. Token refresh rotates and revokes old refresh tokens.

## Risks and Mitigations

1. Risk: RBAC complexity causes privilege gaps.
Mitigation: Add policy matrix and enforcement tests.
2. Risk: Session bugs create forced logouts.
Mitigation: Add robust token integration tests.

## Deliverables

1. Production-ready identity module.
2. Tenant isolation baseline.
3. Auth API documentation and sequence diagrams.
