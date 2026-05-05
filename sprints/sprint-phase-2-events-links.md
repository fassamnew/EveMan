# Sprint: Phase 2 Event and Registration Link Core

## Duration

3 weeks

## Objective

Provide organizer-level control over events and multiple registration links with configurable rules.

## Scope

1. Event CRUD and status transitions.
2. Registration link CRUD per event.
3. Link-level rules: visibility, capacity, approval, open-close windows.

## Non-Goals

1. Dynamic form builder rendering.
2. Badge generation pipeline.

## Backlog

1. Create tables: events, registration_links, link_rules.
2. Implement event APIs: create, update, list, archive.
3. Implement link APIs with slug uniqueness per event.
4. Implement rule validation and effective config resolver.
5. Add organizer portal event management pages.
6. Add link management UI with settings forms.
7. Add permission checks by organization and role.
8. Add audit logging for event and link changes.

## Security and Compliance Requirements

1. Enforce tenant scope in all event and link queries.
2. Validate all public URL slug inputs.
3. Apply rate limits on management APIs.

## Data Model and API Impacts

1. New /organizer/events endpoints.
2. New /organizer/events/:eventId/links endpoints.
3. Public metadata endpoint for active link validation.

## Testing Plan

1. CRUD integration tests for event and link APIs.
2. Validation tests for conflicting capacities and date windows.
3. Authorization tests for staff role restrictions.

## Acceptance Criteria

1. Organizer can create multiple links per event.
2. Link rules persist and resolve correctly.
3. Only authorized users can edit event/link settings.

## Risks and Mitigations

1. Risk: Slug collisions across environments.
Mitigation: Enforce unique indexes and fallback slug suggestions.
2. Risk: Rule conflicts produce broken forms.
Mitigation: Add server-side effective rule pre-check.

## Deliverables

1. Event and link management module.
2. Organizer UI for event and link administration.
3. API docs for event/link lifecycle.
