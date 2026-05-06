# Events and Registration Links API (Phase 2)

This document defines the Phase 2 event and registration-link API contract.

## Route Overview

1. `POST /org/:orgCode/events`
2. `GET /org/:orgCode/events`
3. `PATCH /org/:orgCode/events/:eventId`
4. `POST /org/:orgCode/events/:eventId/archive`
5. `POST /org/:orgCode/events/:eventId/links`
6. `GET /org/:orgCode/events/:eventId/links`
7. `PATCH /org/:orgCode/events/:eventId/links/:linkId`
8. `DELETE /org/:orgCode/events/:eventId/links/:linkId`
9. `GET /public/o/:orgCode/events/:eventId/links/:slug`

## Event Create Request

`POST /org/:orgCode/events`

```json
{
  "name": "Annual Summit 2026",
  "description": "Main conference",
  "startsAt": "2026-09-10T09:00:00.000Z",
  "endsAt": "2026-09-12T18:00:00.000Z"
}
```

## Event Update Request

`PATCH /org/:orgCode/events/:eventId`

```json
{
  "status": "PUBLISHED",
  "description": "Updated event details"
}
```

## Link Create Request

`POST /org/:orgCode/events/:eventId/links`

```json
{
  "title": "VIP Registration",
  "slug": "vip-registration",
  "visibility": "UNLISTED",
  "capacity": 300,
  "approvalMode": "MANUAL",
  "opensAt": "2026-06-01T00:00:00.000Z",
  "closesAt": "2026-09-10T08:00:00.000Z"
}
```

## Link Rule Validation

1. `slug` must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
2. Link slug is unique per event (`eventId + slug`).
3. Duplicate slug responses include fallback slug suggestions in `suggestions`.
4. `opensAt` cannot be after `closesAt`.
5. Event `startsAt` cannot be after `endsAt`.
6. Public metadata slug path parameters are validated with the same slug regex.

## Security and Tenancy Rules

1. All management routes are tenant-scoped (`/org/:orgCode/...`).
2. `ORG_ADMIN` or `SUPER_ADMIN` can mutate event/link settings.
3. `ORG_STAFF` can read tenant data but cannot mutate event/link settings.
4. All event/link mutations are audited (`EVENT_CREATE`, `EVENT_UPDATE`, `EVENT_ARCHIVE`, `LINK_CREATE`, `LINK_UPDATE`, `LINK_DELETE`).
5. Management APIs are rate limited via `ManagementRateLimitGuard`.

## Public Metadata Endpoint

`GET /public/o/:orgCode/events/:eventId/links/:slug`

Returns active link and effective rules (visibility, capacity, approval mode, window, and computed `isOpen`) for registrant entry validation.
