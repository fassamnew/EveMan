# Sprint Phase 8 Validation Checklist

## Objective

Drive launch readiness with reliability, security, and operational validations tied to executable commands and evidence.

## Preconditions

1. `cp .env.example .env`
2. `cp .env apps/api/.env`
3. `npm install`
4. `npm run docker:up`
5. `npm run db:migrate:deploy`

## Quality Gates

1. `npm run typecheck`
2. `npm run test`
3. `npm run test:integration:analytics:local`
4. `npm run phase8:drill:backup-restore`
5. `npm run phase8:drill:resilience`
6. `ITERATIONS=3 npm run phase8:load:baseline`
7. `npm run phase8:security:audit`
8. `npm run phase8:security:triage`

## Hardening Tracks

### 1. Performance and Resilience

1. Run local analytics baseline under seeded dataset (`npm run test:integration:analytics:local`).
2. Capture endpoint latency snapshots for:
- `/org/:orgCode/dashboard/overview`
- `/org/:orgCode/dashboard/reports`
3. Simulate dependency degradation and capture failure behavior.

### 2. Security and Compliance

1. Resolve or explicitly waive all critical/high findings.
2. Validate export authorization controls for non-elevated roles.
3. Verify signed download expiration enforcement.
4. Complete production credential and role access review.

### 3. Backup and Restore

1. Execute backup from staging-like environment.
2. Restore into clean target environment.
3. Validate row counts and key business records post-restore.
4. Document recovery time and data integrity checks.

### 4. Operations and Launch

1. Complete `docs/operations/phase-8-launch-signoff-checklist.md`.
2. Update `docs/operations/phase-8-production-readiness-report.md` with evidence.
3. Finalize on-call ownership and escalation matrix in `docs/operations/phase-8-operational-handover.md`.

## Exit Criteria

1. No unresolved critical vulnerabilities.
2. Launch signoff checklist approved by engineering, product, security, and operations.
3. Production readiness report published with evidence links.
4. Operational handover package completed and shared.

## Latest Execution Notes

1. Backup/restore drill passed locally with artifact `artifacts/phase8/backup-restore-report-20260507-215318.txt`.
2. Resilience smoke drill passed locally with artifact `artifacts/phase8/resilience-smoke-20260507-215324.txt`.
3. Load baseline run passed locally with artifact `artifacts/phase8/load-baseline-report-20260507-215746.txt` (p95=13218ms, error rate=0%).
4. Security audit gate executed with artifact `artifacts/phase8/security-audit-summary-20260507-221339.txt` (critical=0, high=0, moderate=13, low=0).
5. Security triage report generated with actionable remediation backlog: `artifacts/phase8/security-triage-20260507-221308.md`.
6. Moderate-risk acceptance and ownership matrix documented: `docs/operations/phase-8-moderate-risk-acceptance.md`.
7. Governance open-item tracker added and maintained in `docs/operations/phase-8-launch-signoff-checklist.md` under "Current Open Items Snapshot (2026-05-08)".
8. Current release status: technical gates green; launch decision pending governance closure (signoffs, access/secrets review, observability/ops/product approvals).
9. Live signoff capture location established in `docs/operations/phase-8-launch-signoff-checklist.md` under "Signoff Status Table" and "Meeting Minutes Template".
