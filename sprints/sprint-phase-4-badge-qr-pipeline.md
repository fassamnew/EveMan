# Sprint: Phase 4 Badge and QR Pipeline

## Duration

3 weeks

## Objective

Implement scalable badge and QR generation pipelines with secure tokenization and template-based rendering.

## Scope

1. Badge template model and assignment.
2. Secure QR issuance and verification token structure.
3. Async badge rendering and storage.
4. Badge delivery attachment/link workflow.

## Non-Goals

1. Advanced drag-and-drop designer UX.
2. Full analytics suite.

## Backlog

1. Create tables: badge_templates, qr_codes, badges.
2. Implement template assignment at registration link level.
3. Implement signed QR payload format and hash storage.
4. Implement BullMQ jobs for badge render and retry policy.
5. Implement badge storage to S3 with signed download URLs.
6. Implement badge regeneration endpoint for approved users.
7. Add renderer metrics and job failure alerting.
8. Build organizer template management UI v1.

## Security and Compliance Requirements

1. QR payload must avoid exposing raw PII.
2. Token hashes only stored in DB for verification.
3. Signed URLs with short expiration windows.

## Data Model and API Impacts

1. New /organizer/templates/badges endpoints.
2. New /organizer/registrants/:id/badge/regenerate endpoint.
3. New /verify/qr endpoint consumed by scanner services.

## Testing Plan

1. Integration tests for token verification states.
2. Queue worker tests for retry and failure dead-lettering.
3. Render tests for template compatibility and output quality.

## Acceptance Criteria

1. Registrant receives valid badge and QR after registration or approval.
2. Organizer can regenerate badges safely.
3. Verification endpoint validates and rejects tampered tokens.

## Risks and Mitigations

1. Risk: Queue backlog delays confirmations.
Mitigation: Autoscale workers and set queue priority.
2. Risk: Render failures from invalid templates.
Mitigation: Template linting and pre-publish checks.

## Deliverables

1. Production badge and QR pipeline.
2. Template assignment model.
3. Monitoring for generation throughput and failures.
