# EveMange Production Rewrite Implementation Plan

## 1. Target Architecture

1. Backend: TypeScript with NestJS, REST-first APIs with event-driven internals.
2. Database: MySQL 8 with strict migration-only schema management.
3. Cache and session support: Redis.
4. Async processing: BullMQ workers for imports, exports, emails, badge rendering.
5. Object storage: S3-compatible storage for photos, badges, import files, and artifacts.
6. Web frontends: Next.js Super Admin SaaS dashboard plus organization and registrant portals.
7. Mobile scanner app: React Native with offline-first sync queue.
8. Observability: OpenTelemetry, Prometheus, Grafana, centralized structured logs.
9. Deployment: Docker with Kubernetes or ECS, managed via Terraform.
10. CI/CD: GitHub Actions with dev, staging, and production promotion gates.
11. Tenant routing strategy: organization portal served under `/o/:orgCode` with strict tenant guards.

## 2. Security Baseline (Embedded From Day 1)

1. Authentication: Short-lived access JWT and rotating refresh tokens.
2. Authorization: RBAC plus resource-level tenancy checks.
3. Passwords: Argon2id hashing with strong cost configuration.
4. Secrets management: Cloud secrets manager only in production.
5. API hardening: Validation on every boundary, strict rate limits, payload caps.
6. Transport and browser security: TLS, HSTS, strict CORS allowlists, secure headers.
7. Data protection: Encryption at rest, key rotation, PII classification and handling.
8. File upload security: MIME and signature checks, malware scanning, signed URLs.
9. Auditability: Immutable audit logs for auth events and privileged actions.
10. Secure SDLC: SAST, dependency scanning, container scanning, DAST in staging.

## 3. Core Domain Modules

1. Organizations and tenant isolation.
2. Users, roles, and fine-grained permissions.
3. Events and event lifecycle settings.
4. Registration links with per-link rules.
5. Dynamic form builder and response storage.
6. Registration page template engine.
7. Badge template engine and rendering pipeline.
8. QR token issuance and validation.
9. Attendee lifecycle and approval workflows.
10. Onsite check-in and scanner session tracking.
11. Communication templates and delivery logs.
12. Import/export job tracking and report generation.

## 4. Implementation Phases

### Phase 0: Foundations (2 weeks)

1. Finalize architecture decision records and coding standards.
2. Initialize monorepo and environment strategy.
3. Configure linting, formatting, unit testing, integration testing, migration tooling.
4. Set up CI pipeline with quality gates.

Deliverable: Production-ready skeleton with green pipelines.

### Phase 1: Identity and Tenancy Core (2 weeks)

1. Build organizations, users, roles, permissions schema.
2. Implement secure login, token refresh, logout, lockout, password reset.
3. Add tenancy middleware and authorization guards.
4. Build Super Admin dashboard shell for organization lifecycle operations.
5. Implement organization portal routing contract under `/o/:orgCode`.

Deliverable: Secure tenant-aware identity baseline.

### Phase 2: Event and Registration Link Core (3 weeks)

1. Implement event CRUD and event-level settings.
2. Implement multiple registration links per event.
3. Add per-link configuration: capacity, visibility, approval, open/close windows.

Deliverable: Organization admins can model multi-link event structures.

### Phase 3: Registrant Experience (3 weeks)

1. Build public registration pages per link.
2. Render dynamic form fields from form-builder definitions.
3. Add confirmation, re-download badge flow, and registration instructions.

Deliverable: End-to-end category-based registration journeys.

### Phase 4: Badge and QR Pipeline (3 weeks)

1. Build badge template management and assignment.
2. Implement secure QR payload format and validation.
3. Add async badge generation and delivery via job queue.

Deliverable: Reliable badge lifecycle with scalable generation.

### Phase 5: Attendee Ops and Communication (3 weeks)

1. Build organization portal attendee table with filters and lifecycle actions.
2. Implement CSV and Excel import with mapping and duplicate policies.
3. Add communication templates and bulk delivery with logs.

Deliverable: Complete organization operations console.

### Phase 6: Mobile Scanner and Offline Sync (4 weeks)

1. Implement mobile login and event assignment.
2. Implement QR scan verification states and duplicate protection.
3. Build offline capture, sync retries, and scan history.

Deliverable: Production-ready usher workflow.

### Phase 7: Analytics and Reporting (2 weeks)

1. Build live dashboard metrics and category analytics.
2. Implement report generation and secure exports.
3. Add usher performance and communication analytics.

Deliverable: Operational insights and reporting layer.

### Phase 8: Hardening and Launch (2 weeks)

1. Perform load testing and resilience testing.
2. Run penetration test and close high-severity findings.
3. Validate backup-restore drills and runbooks.
4. Final production readiness review.

Deliverable: Launch-ready platform with compliance and reliability checks.

## 5. Database Strategy (MySQL)

1. Use UUID keys and explicit tenant scoping columns.
2. Enforce foreign keys and composite indexes for tenant-scoped queries.
3. Use migration-only schema evolution with audited migration history.
4. Add soft delete where needed plus immutable audit trails.
5. Use read replicas for reporting workloads if needed.

## 6. Testing and Quality Gates

1. Unit tests for services, utilities, guards, and validators.
2. Integration tests for API routes and DB behavior.
3. Contract tests for frontend-backend API compatibility.
4. End-to-end tests for critical flows: registration, approval, check-in, import, export.
5. Security test gate requiring zero unresolved critical findings.

## 7. Delivery and Team Workflow

1. Build in vertical slices: schema, API, UI, tests in each feature branch.
2. Use feature flags for progressive rollout.
3. Weekly architecture and security reviews.
4. Biweekly staging demos using seeded realistic event data.

## 8. Definition of Done for Production

1. Tenant isolation verified by automated tests and manual abuse checks.
2. All privileged actions produce audit logs.
3. Backup and restore tested successfully in staging.
4. SLO targets met for key APIs and scan flows.
5. Operational documentation complete: runbooks, incident playbooks, on-call guides.

## 9. Initial Milestone Plan (First 8 Weeks)

### Weeks 1-2

1. Monorepo setup and CI foundations.
2. MySQL schema baseline and migration framework.
3. Auth and tenancy architecture finalized.

### Weeks 3-4

1. Users, roles, organizations implemented.
2. Auth endpoints and session lifecycle implemented.
3. RBAC middleware and guard integration.

### Weeks 5-6

1. Events and registration links APIs.
2. Organization portal event management UI under `/o/:orgCode`.
3. Dynamic registration link rules and validation.

### Weeks 7-8

1. Public registrant portal for per-link registration.
2. Form-builder v1 and response storage.
3. Initial badge and QR generation queue pipeline.

## 10. Immediate Next Steps

1. Approve stack choices and hosting model.
2. Create the repo branch strategy and environment setup.
3. Implement Phase 0 deliverables before feature coding.
4. Freeze legacy rewrite scope and publish migration decision record.
