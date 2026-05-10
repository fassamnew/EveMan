# Sprint: Phase 7 Analytics and Reporting

## Duration

2 weeks

## Objective

Provide operational visibility through live dashboards and secure report exports.

## Scope

1. Organization dashboard metrics and trend views.
2. Check-in and category analytics.
3. Export jobs and downloadable reports.
4. Usher and communication performance views.

## Non-Goals

1. Enterprise data warehouse integration.
2. Subscription billing analytics.

## Backlog

1. Build aggregated read models for dashboard KPIs.
2. Implement dashboard APIs with caching.
3. Implement report generation jobs and storage.
4. Implement role-based export authorization.
5. Build frontend analytics screens and filters.
6. Add communication performance breakdown views.
7. Add usher scan performance reports.

## Implementation Status

Completed in code:
1. Backlog item 1 (kickoff): aggregated dashboard read model implemented in analytics service.
2. Backlog item 2 (baseline): `GET /org/:orgCode/dashboard/overview` added with short-lived caching.
3. Backlog item 3 (backend baseline): async report generation job `analytics.report.generate` with persisted CSV/JSON artifacts.
4. Backlog item 4 (backend baseline): elevated-role export gating plus signed, time-limited report download links and export audit events.
5. Backlog item 6 (backend baseline): communication performance by event included in dashboard payload.
6. Backlog item 7 (backend baseline): usher scan performance included in dashboard payload.

In progress:
1. Backlog item 5 (expanded baseline): org analytics dashboard includes filters, export queue controls, report status polling, secure download trigger, permission-aware export UX messaging, and frontend communication/usher performance breakdown views.
2. Performance and data-consistency verification for large datasets (baseline integration scenario implemented and passing locally).
3. Broader integration matrix execution (core analytics integration run now validated against live MySQL/Redis).

Recent validation additions:
1. Unit coverage for analytics export service flows added in `apps/api/src/modules/analytics/analytics.service.test.ts` (role gating, queue/list mapping, signed link issue, public download signature path).
2. Edge-case coverage added for non-completed report download attempts, invalid signatures, and forwarded-IP audit capture; analytics service request IP parsing hardened for optional headers.
3. Controller coverage added in `apps/api/src/modules/analytics/analytics.controller.test.ts` for route delegation and public download response headers.
4. Operational closeout checklist added in `sprints/sprint-phase-7-validation-checklist.md` with reproducible DB/Redis-backed validation steps.
5. DB-backed analytics integration now includes signed report download end-to-end scenario (`queue -> complete -> download-link -> /public/reports/download`).
6. DB-backed analytics integration now includes larger seeded dataset scenario with KPI consistency assertions and response-time guard.

## Security and Compliance Requirements

1. Exports must be signed and time-limited.
2. Sensitive reports must require elevated role checks.
3. Export actions must be fully audited.

## Data Model and API Impacts

1. New /org/:orgCode/dashboard endpoints.
2. New /org/:orgCode/dashboard/reports endpoints.
3. Extended export_jobs status lifecycle.

## Testing Plan

1. Data consistency tests between transactional tables and analytics views.
2. Performance tests for dashboard endpoints.
3. Access-control tests for report permissions.

## Acceptance Criteria

1. Organization admin sees live KPI dashboard with correct totals.
2. Reports generate asynchronously and download securely.
3. Usher and communication analytics are available by event.

## Risks and Mitigations

1. Risk: Slow aggregation on large datasets.
Mitigation: Pre-aggregated views and cache invalidation strategy.
2. Risk: Report overexposure.
Mitigation: Strict role checks and signed URL expiration.

## Deliverables

1. Analytics dashboard module.
2. Secure export pipeline.
3. Performance and correctness benchmarks.
