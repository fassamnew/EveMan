# Registrant Experience API (Phase 3)

This document defines the public registration APIs for Phase 3.

## Route Overview

1. `GET /public/register/:slug`
2. `GET /public/register/:slug/schema`
3. `POST /public/register/:slug/submissions`
4. `GET /public/register/lookup?referenceCode=...&email=...`

## Resolve Link

`GET /public/register/:slug`

Returns public registration metadata for an active registration link.

## Schema Endpoint

`GET /public/register/:slug/schema`

Returns dynamic form fields ordered by `position`.

## Submission Request

`POST /public/register/:slug/submissions`

```json
{
  "fullName": "Ada Lovelace",
  "email": "ada@example.com",
  "consentAccepted": true,
  "consentPolicyVersion": "v1",
  "captchaToken": "dev-token-123",
  "responses": [
    { "key": "country", "value": "ET" },
    { "key": "age", "value": 31 }
  ]
}
```

Success response:

```json
{
  "referenceCode": "A1B2C3D4",
  "status": "CONFIRMED"
}
```

## Retrieve by Reference

`GET /public/register/lookup?referenceCode=...&email=...`

Returns registrant details for re-download and confirmation views.

## Validation and Security

1. Submission endpoint is protected by public rate limiting.
2. `captchaToken` is required and validated.
3. Dynamic field values are validated by field type and constraints.
4. Duplicate registration is blocked per `(registrationLinkId, email)`.
5. Consent is required and stored with timestamp and policy version.
