# Sprint: Phase 5 Attendee Ops and Communication

## Duration

3 weeks

## Objective

Deliver organization-portal operational tools for attendee lifecycle management, imports, and communication workflows.

## Scope

1. Attendee management table with lifecycle actions.
2. CSV and Excel import with mapping and duplicate handling.
3. Communication templates and bulk send operations.
4. Communication and import logs.

## Non-Goals

1. Mobile scanner offline flows.
2. Final BI-grade analytics warehouse.

## Backlog

1. Create tables: communication_templates, communication_logs, import_jobs, import_errors.
2. Build attendee listing API with filters and paging.
3. Build attendee actions: approve, reject, edit, resend badge.
4. Build import API with column mapping profile support.
5. Build duplicate strategy options: skip, update, flag.
6. Build template CRUD for email and SMS content.
7. Build bulk send API and queued delivery workers.
8. Build organization portal UI for attendee ops, imports, and communications.

## Implementation Status

Completed in code and integration tests:
1. Backlog item 1: schema and migration foundation for `communication_templates`, `communication_logs`, `import_jobs`, and `import_errors`.
2. Backlog item 2: attendee listing API with filters and paging.
3. Backlog item 3: attendee lifecycle actions for approve/reject/edit and resend badge.
4. Backlog item 4: import API with mapping profile payload and queued processing.
5. Backlog item 5: duplicate handling strategies (skip/update/flag) during imports.
6. Backlog item 6: communication template CRUD for email and SMS content.
7. Backlog item 7: bulk send API and queued delivery worker with failure simulation support.

In progress:
1. Backlog item 8: organization portal UI for attendee ops, imports, and communications.

## Security and Compliance Requirements

1. Enforce export/import permission checks by role.
2. Validate uploaded file type and scan for malware.
3. Record communication sender and delivery metadata.

## Data Model and API Impacts

1. New /org/:orgCode/attendees endpoints.
2. New /org/:orgCode/imports endpoints.
3. New /org/:orgCode/communications endpoints.

## Testing Plan

1. Integration tests for lifecycle actions and state transitions.
2. Import tests with malformed rows and duplicate scenarios.
3. Communication delivery tests with provider failure simulation.

## Acceptance Criteria

1. Organization staff can manage attendee lifecycle from one screen.
2. Imports support mapping and detailed error reporting.
3. Communication templates can be reused and tracked.

## Risks and Mitigations

1. Risk: Large imports impact API performance.
Mitigation: Queue-based processing and chunked parsing.
2. Risk: Message delivery inconsistencies.
Mitigation: Provider fallback and retry observability.

## Deliverables

1. Attendee ops console.
2. Import and communication modules.
3. Operational logs and audit traces.
