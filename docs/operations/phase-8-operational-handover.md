# Phase 8 Operational Handover Package

## Service Inventory

1. API service: `apps/api`
2. Web service: `apps/web`
3. Infrastructure dependencies: MySQL, Redis, object storage (local MinIO / S3), OTEL collector

## Core Commands

1. Start infrastructure: `npm run docker:up`
2. Stop infrastructure: `npm run docker:down`
3. Apply migrations: `npm run db:migrate:deploy`
4. Run API only: `npm run dev:api`
5. Run web only: `npm run dev:web`
6. Analytics integration local: `npm run test:integration:analytics:local`
7. Backup/restore drill: `npm run phase8:drill:backup-restore`
8. Resilience smoke drill: `npm run phase8:drill:resilience`
9. Load baseline run: `ITERATIONS=3 npm run phase8:load:baseline`

## SLO Baseline (to be finalized)

1. Dashboard overview endpoint p95: baseline not yet captured in dedicated endpoint-latency probe (analytics integration run remains under 5s guard).
2. Report generation completion target: pending product/ops SLO agreement.
3. Export link issuance p95: pending direct endpoint benchmark.
4. Error budget policy: pending SRE/operations approval.

## Alerting Matrix (initial)

1. API health check failures.
2. Elevated 5xx rate on tenant-scoped routes.
3. Queue backlog growth for `analytics.report.generate`.
4. Repeated report export failures.

## Incident Response

1. Primary on-call: TBD (Operations lead assignment required by 2026-05-15).
2. Secondary on-call: TBD (Operations lead assignment required by 2026-05-15).
3. Escalation channel: #incident-ops (confirm final channel by 2026-05-15).
4. Incident commander rotation: Engineering manager (launch window), transition to operations weekly rotation post-launch.

## Launch-Day Ownership

1. Launch commander: Engineering manager
2. Rollback approver: Engineering manager
3. Security duty officer: Security representative
4. Communications owner: Product manager
5. Post-launch verification owner: Operations lead

## Backup and Restore

1. Backup frequency: pending policy ratification.
2. Backup retention: pending policy ratification.
3. Restore test cadence: pending policy ratification.
4. Latest successful restore drill date: 2026-05-07 (`artifacts/phase8/backup-restore-report-20260507-215318.txt`).
5. Latest resilience smoke drill date: 2026-05-07 (`artifacts/phase8/resilience-smoke-20260507-215324.txt`).

## Runbook Links

1. Production readiness report: `docs/operations/phase-8-production-readiness-report.md`
2. Launch signoff checklist: `docs/operations/phase-8-launch-signoff-checklist.md`
3. Sprint hardening plan: `sprints/sprint-phase-8-hardening-launch.md`
