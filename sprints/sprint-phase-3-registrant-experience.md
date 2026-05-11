# Sprint: Phase 3 Registrant Experience

## Duration

3 weeks

## Objective

Launch public registration experiences for each link with dynamic forms, confirmations, and registrant self-service essentials.

## Scope

1. Public registration page rendering from link settings.
2. Dynamic form field rendering and submission.
3. Registration confirmation workflows.
4. Badge re-download by reference/email.

## Non-Goals

1. Full badge designer.
2. Mobile usher workflows.

## Backlog

1. Create tables: form_fields, registrants, registrant_responses.
2. Implement public link resolver endpoint.
3. Implement dynamic form schema endpoint.
4. Implement registration submission API with validation and duplicate policy.
5. Implement consent capture and consent audit fields.
6. Implement confirmation email trigger after registration.
7. Implement reference code generation and retrieval endpoint.
8. Build Next.js registrant pages and submission UI.
9. Build re-download badge page and validation flow.

## Security and Compliance Requirements

1. CAPTCHA or bot mitigation on public registration endpoint.
2. Strict input validation for all dynamic field types.
3. Consent data stored with timestamp and policy version.

## Data Model and API Impacts

1. New public endpoints under /public/register/:slug.
2. New registrant retrieval endpoint for re-download flow.

## Testing Plan

1. E2E tests for full public registration flow.
2. Validation tests for required and custom fields.
3. Duplicate registration policy tests.

## Section 4 Verification Checklist

Run:
1. `npm run typecheck -w @evemange/api`
2. `npm run test -w @evemange/api -- src/modules/registrations/section4-compliance.integration.test.ts`

Pass criteria:
1. Event settings lifecycle passes: update + readback for venue, branding URLs, registration windows, and check-in policy.
2. Link settings lifecycle passes: update + readback for confirmationMessage, emailTemplateName, photoUpload, accessMode, and accessPassword requirements.
3. Access enforcement passes: protected link blocks unauthorized resolve and allows authorized resolve.
4. Photo policy enforcement passes: REQUIRED blocks missing photo and accepts valid photo.
5. Confirmation/template behavior passes:
- Matching organization email template name resolves and is recorded.
- Missing template falls back to `default-registration-confirmation` and is recorded.
- confirmationMessage is returned in submit response and stored in submit metadata.

## Acceptance Criteria

1. Public link shows correct event/link form.
2. Registrant can submit and receive confirmation.
3. Registrant can re-download badge with valid reference.

## Risks and Mitigations

1. Risk: Dynamic schema drift between UI and API.
Mitigation: Serve form schema from API and use contract tests.
2. Risk: Public endpoint abuse.
Mitigation: Add layered bot and rate controls.

## Deliverables

1. Registrant portal v1.
2. Dynamic registration pipeline.
3. Confirmation and re-download workflows.

## Remaining Tasks

1. Implement real confirmation email delivery in the queue worker (replace logging-only behavior with SMTP/provider send and delivery retry handling).
2. Enforce production CAPTCHA verification (require configured provider verification outside development and remove permissive fallback behavior in production environments).
