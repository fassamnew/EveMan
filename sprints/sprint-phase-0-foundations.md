# Sprint: Phase 0 Foundations

## Duration

2 weeks

## Objective

Establish the production-grade engineering baseline so all feature phases can ship safely and predictably.

## Scope

1. Monorepo setup and workspace structure.
2. Baseline backend and frontend application shells.
3. MySQL, Redis, and object storage local development setup.
4. CI pipeline with lint, typecheck, tests, and security scans.
5. Migration tooling and initial empty migration.
6. Logging, metrics, tracing bootstrap.
7. Infrastructure as code skeleton and environment definitions.

## Non-Goals

1. Business features.
2. Production data migration from legacy SQLite.

## Backlog

1. Create repository structure: apps, packages, infra, docs.
2. Add coding standards, PR template, branch policy, CODEOWNERS.
3. Add NestJS API skeleton with health and readiness endpoints.
4. Add Next.js web skeleton and shared UI package.
5. Add environment config validation package.
6. Add MySQL migration framework with baseline migration.
7. Add Redis connection and queue initialization scaffolding.
8. Add GitHub Actions workflows for PR and main branch.
9. Add SAST, dependency, and container scanning jobs.
10. Add OpenTelemetry instrumentation bootstrapping.
11. Add Docker Compose for local developer stack.
12. Add architecture decision record documents.

## Security and Compliance Requirements

1. Secrets never committed to source control.
2. Security scan pipeline must run on every PR.
3. Dependency lockfiles required and audited.

## Data Model and API Impacts

1. No domain tables beyond bootstrap metadata and migration tracking.
2. API scope limited to health endpoints.

## Testing Plan

1. Verify CI checks fail on lint/type/test regressions.
2. Verify local environment boots with one command.
3. Verify health endpoint and tracing export in local mode.

## Acceptance Criteria

1. Fresh clone to running local stack in under 20 minutes.
2. CI pipeline green for baseline branch.
3. Security scans integrated and blocking on critical severity.
4. Migration framework operational with rollback support.

## Risks and Mitigations

1. Risk: Tooling over-complexity slows team.
Mitigation: Keep defaults minimal and document conventions.
2. Risk: Environment drift across machines.
Mitigation: Pin versions and enforce preflight checks.

## Deliverables

1. Working monorepo scaffold.
2. CI and security baseline.
3. Operational developer onboarding guide.
