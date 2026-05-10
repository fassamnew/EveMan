# Sprint Phase 6 Validation and Sign-Off Checklist

## Purpose

Provide a single, execution-ready checklist to close Sprint Phase 6 blockers:
1. Device reliability validation for offline/background sync.
2. Production telemetry endpoint verification.

## Scope

This checklist validates implemented mobile features for:
1. Scanner verification and check-in state handling.
2. Offline queue persistence, retry, backoff, encryption, and sync.
3. Background sync behavior.
4. Telemetry capture, export, and endpoint upload flow.

## Exit Criteria (Sprint 6 Complete)

Sprint Phase 6 can be marked complete only when all are true:
1. All required device scenarios pass on iOS and Android.
2. No data-loss scenario is observed.
3. Background sync behavior is verified with diagnostics evidence.
4. Telemetry endpoint flow is verified end-to-end in staging/production-like environment.
5. Evidence artifacts are attached and reviewed.

---

## A. Device Reliability Validation

### A1. Test Environment

Fill before execution:
1. iOS device model / OS:
2. Android device model / OS:
3. Mobile app build identifier:
4. API base URL:
5. Telemetry URL (if configured):
6. Test account(s):
7. Date/time window:

### A2. Scenario Matrix

Mark each scenario for each platform.

Status legend:
- PASS
- FAIL
- BLOCKED

#### Scenario 1: Foreground Online Scan

Expected:
1. Scan/submit succeeds.
2. Check-in result shown as ACCEPTED/DUPLICATE/IDEMPOTENT_REPLAY/INVALID.
3. History and telemetry entries update.

Record:
1. iOS status:
2. Android status:
3. Evidence file/link:
4. Notes:

#### Scenario 2: Offline Queue Build-Up (Airplane Mode)

Steps:
1. Enable airplane mode.
2. Perform at least 3 scan submits.

Expected:
1. Items are queued offline.
2. Queue count increases.
3. History shows QUEUED_OFFLINE entries.

Record:
1. iOS status:
2. Android status:
3. Evidence file/link:
4. Notes:

#### Scenario 3: Reconnect and Deferred Sync

Steps:
1. Disable airplane mode.
2. Trigger sync manually and wait for interval/background fetch.

Expected:
1. Queued count decreases over time.
2. Deferred count reflects backoff windows.
3. Sync result and source update in diagnostics.

Record:
1. iOS status:
2. Android status:
3. Evidence file/link:
4. Notes:

#### Scenario 4: Retry Limit and Drop Behavior

Steps:
1. Force repeated server/network failures for queued items.
2. Allow retries up to threshold.

Expected:
1. Item retries until max-attempt limit.
2. Item is dropped only after configured retry limit.
3. Drop reflected in history/telemetry/diagnostics.

Record:
1. iOS status:
2. Android status:
3. Evidence file/link:
4. Notes:

#### Scenario 5: Backgrounded App Sync

Steps:
1. Queue one or more items.
2. Move app to background.
3. Wait for background fetch window.

Expected:
1. Background sync attempts are recorded.
2. Diagnostics source shows BACKGROUND when background task executes.

Record:
1. iOS status:
2. Android status:
3. Evidence file/link:
4. Notes:

#### Scenario 6: Android Reboot Behavior

Steps:
1. Queue one or more items.
2. Reboot Android device.
3. Reopen app and observe sync progression.

Expected:
1. Queue survives reboot.
2. Sync resumes and processes items.

Record:
1. Android status:
2. Evidence file/link:
3. Notes:

### A3. Diagnostics Evidence Capture

Required artifacts per platform:
1. Sync diagnostics export JSON.
2. Scan history export JSON.
3. Telemetry export JSON.
4. Short run log (scenario outcomes, timestamps, anomalies).

Store artifact paths here:
1.
2.
3.
4.

### A4. Reliability Sign-Off

1. Any FAIL or BLOCKED remaining? (Yes/No)
2. If yes, list issue IDs:
3. Reviewer name:
4. Date:
5. Decision: PASS / HOLD

---

## B. Telemetry Endpoint Verification

### B1. Contract and Security Checks

Verify before runtime tests:
1. Endpoint URL is configured via EXPO_PUBLIC_TELEMETRY_URL.
2. Payload schema is documented and accepted.
3. Transport is HTTPS.
4. Auth requirement is enforced (if applicable).
5. Sensitive fields policy/redaction reviewed.

Status:
1. PASS / FAIL
2. Notes:

### B2. Ingestion Scenarios

#### Scenario 1: Successful Upload

Expected:
1. App reports success message.
2. Backend receives payload.
3. Local telemetry buffer clears on success.

Record:
1. Status:
2. Evidence:
3. Notes:

#### Scenario 2: Server Rejection (4xx)

Expected:
1. App reports failure.
2. Local telemetry buffer is not cleared.

Record:
1. Status:
2. Evidence:
3. Notes:

#### Scenario 3: Server Error (5xx)

Expected:
1. App reports failure.
2. Local telemetry buffer is not cleared.

Record:
1. Status:
2. Evidence:
3. Notes:

#### Scenario 4: Network Failure

Expected:
1. App reports failure.
2. Local telemetry buffer is not cleared.

Record:
1. Status:
2. Evidence:
3. Notes:

### B3. Backend Observability

Confirm backend has:
1. Request logging for ingestion endpoint.
2. Success/failure counters.
3. Alerting for sustained failures.

Status:
1. PASS / FAIL
2. Notes:

### B4. Telemetry Sign-Off

1. Any FAIL or BLOCKED remaining? (Yes/No)
2. If yes, list issue IDs:
3. Reviewer name:
4. Date:
5. Decision: PASS / HOLD

---

## C. Final Sprint 6 Decision

Mark complete only if all checks pass.

1. Device reliability validation: PASS / HOLD
2. Telemetry endpoint verification: PASS / HOLD
3. Evidence artifacts attached: YES / NO
4. Final reviewer:
5. Date:
6. Sprint 6 status: COMPLETE / INCOMPLETE

## D. Open Issues

List unresolved items here:
1.
2.
3.
