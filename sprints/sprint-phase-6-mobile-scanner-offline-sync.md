# Sprint: Phase 6 Mobile Scanner and Offline Sync

## Duration

4 weeks

## Objective

Release a robust usher mobile app that supports secure scan workflows online and offline.

## Scope

1. Mobile login and assigned-event selection.
2. QR scan verification states and duplicate handling.
3. Offline scan capture and deferred sync.
4. Scan history and usher activity tracking.

## Non-Goals

1. Full admin analytics dashboard.
2. Licensing and billing features.

## Backlog

1. Build React Native app shell and secure storage setup.
2. Implement auth with refresh token handling on mobile.
3. Implement event assignment endpoint and mobile selector.
4. Implement scanner screen and verification response states.
5. Implement offline queue persistence and retry worker.
6. Implement conflict resolution and idempotent check-in API.
7. Implement scan history and sync status screens.
8. Add device telemetry and crash reporting.

## Security and Compliance Requirements

1. Token storage must use platform secure keystore.
2. Device-bound session checks for stolen token mitigation.
3. Offline payload encryption at rest on device.

## Data Model and API Impacts

1. New check-in metadata fields for source and sync state.
2. New /usher/assignments and /usher/checkins endpoints.

## Testing Plan

1. Device tests for camera permissions and scanner reliability.
2. Offline mode tests with airplane mode scenarios.
3. Sync conflict tests with duplicate submissions.

## Acceptance Criteria

1. Usher can scan and verify attendee status quickly.
2. Offline scans persist and sync without data loss.
3. Duplicate and invalid scans are clearly flagged.

## Risks and Mitigations

1. Risk: Device camera inconsistencies.
Mitigation: Multi-device test matrix and fallback scan options.
2. Risk: Offline queue corruption.
Mitigation: Checksums and replay-safe idempotency keys.

## Deliverables

1. Mobile usher app v1.
2. Offline sync engine.
3. Check-in API hardening for mobile workloads.
