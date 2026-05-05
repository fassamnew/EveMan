# Sprint: Phase 5 Attendee Ops and Communication

## Duration

3 weeks

## Objective

Deliver organizer operational tools for attendee lifecycle management, imports, and communication workflows.

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
8. Build organizer UI for attendee ops, imports, and communications.

## Security and Compliance Requirements

1. Enforce export/import permission checks by role.
2. Validate uploaded file type and scan for malware.
3. Record communication sender and delivery metadata.

## Data Model and API Impacts

1. New /organizer/attendees endpoints.
2. New /organizer/imports endpoints.
3. New /organizer/communications endpoints.

## Testing Plan

1. Integration tests for lifecycle actions and state transitions.
2. Import tests with malformed rows and duplicate scenarios.
3. Communication delivery tests with provider failure simulation.

## Acceptance Criteria

1. Organizer can manage attendee lifecycle from one screen.
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
