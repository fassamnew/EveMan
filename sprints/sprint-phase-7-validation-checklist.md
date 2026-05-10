# Sprint Phase 7 Validation Checklist

## Objective

Validate analytics dashboard, report export pipeline, and signed download security in a DB/Redis-backed environment.

## Preconditions

1. Copy environment values: `cp .env.example .env`.
2. Confirm `DATABASE_URL` points to local MySQL (`mysql://evemange:evemange_dev@localhost:3307/evemange`).
3. Confirm Redis values are present (`REDIS_HOST=localhost`, `REDIS_PORT=6379`).
4. Install dependencies: `npm install`.
5. Start infra: `npm run docker:up`.
6. Apply migrations: `npm run db:migrate:deploy`.

## Fast Validation Commands

1. API typecheck: `npx tsc -p apps/api/tsconfig.json --noEmit`.
2. Web typecheck: `npx tsc -p apps/web/tsconfig.json --noEmit`.
3. Analytics unit tests: `npx vitest run apps/api/src/modules/analytics/analytics.controller.test.ts apps/api/src/modules/analytics/analytics.service.test.ts`.
4. Analytics integration test file: `npm run test:integration:analytics`.
5. Local env-injected analytics integration run: `npm run test:integration:analytics:local`.

## Manual Functional Checks

1. Start API and web: `npm run dev:api` and `npm run dev:web`.
2. Open analytics screen: `/o/{orgCode}/analytics`.
3. Verify dashboard metrics render and refresh.
4. Verify event filtering/sorting updates event rows.
5. As ORG_ADMIN:
- Queue CSV report.
- Observe report status transitions (`QUEUED` -> `ACTIVE`/`COMPLETED`).
- Trigger download and verify file downloads.
6. As ORG_STAFF:
- Confirm export controls are disabled.
- Confirm permission message is visible.
7. Verify signed link behavior:
- Use generated link before expiration (expect download success).
- Retry after expiration (expect rejection).

## Security and Audit Checks

1. Verify `REPORT_EXPORT_QUEUED` audit entries exist.
2. Verify `REPORT_EXPORT_STARTED` and `REPORT_EXPORT_COMPLETED` (or `REPORT_EXPORT_FAILED`) entries exist.
3. Verify `REPORT_EXPORT_DOWNLOAD_LINK_ISSUED` entries include link TTL metadata.
4. Verify `REPORT_EXPORT_DOWNLOADED` entries are written for successful public downloads.

## Expected Pass Criteria

1. Analytics integration tests execute without skip.
2. Export jobs complete and artifacts are downloadable with signed URLs.
3. Unauthorized export attempts are rejected with 403.
4. Expired/invalid signatures are rejected.
5. Required audit events are present for queue, completion, and download actions.

## Latest Execution Notes

1. Non-skipped analytics integration run confirmed locally with MySQL/Redis using env-injected command.
2. Initial skip/error causes were:
- Missing `DATABASE_URL` in test process environment.
- Missing JWT secrets in test process environment.
3. The `test:integration:analytics:local` script addresses both values by sourcing `apps/api/.env` inline.
4. Integration coverage now includes end-to-end signed report artifact download verification through `/public/reports/download`.
5. Integration coverage now includes larger seeded dataset verification for KPI consistency plus local response-time guard (< 5s in current baseline run).

## Evidence to Attach

1. Command output for typecheck and analytics integration run.
2. Screenshot of analytics report queue and completed download-ready state.
3. Example signed URL rejection response after expiry.
4. Audit log query output for a single report lifecycle.
