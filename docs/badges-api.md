# Badges and QR API

This document describes Phase 4 badge and QR endpoints.

## Authentication

Organization-scoped endpoints require `Authorization: Bearer <access_token>`.

## Endpoints

### Create Badge Template

- Method: `POST`
- Path: `/org/:orgCode/templates/badges`
- Guards: access token, org access, management rate limit
- Body:

```json
{
  "name": "Standard",
  "version": 1,
  "configJson": {
    "layout": "v1"
  }
}
```

### List Badge Templates

- Method: `GET`
- Path: `/org/:orgCode/templates/badges`
- Guards: access token, org access

### Update Badge Template

- Method: `PATCH`
- Path: `/org/:orgCode/templates/badges/:templateId`
- Guards: access token, org access, management rate limit
- Body (partial):

```json
{
  "name": "Standard Updated",
  "version": 2,
  "configJson": {
    "layout": "v2"
  },
  "isActive": true
}
```

### Disable Badge Template

- Method: `DELETE`
- Path: `/org/:orgCode/templates/badges/:templateId`
- Guards: access token, org access, management rate limit

### Assign Template To Link

- Method: `POST`
- Path: `/org/:orgCode/templates/badges/:templateId/assign/:linkId`
- Guards: access token, org access, management rate limit

### Regenerate Badge

- Method: `PATCH`
- Path: `/org/:orgCode/registrants/:registrantId/badge/regenerate`
- Guards: access token, org access, management rate limit

### Get Signed Badge Download URL

- Method: `GET`
- Path: `/org/:orgCode/registrants/:registrantId/badge/download-url`
- Guards: access token, org access
- Query:
  - `expiresInSeconds` optional, clamped to 60..900

Response:

```json
{
  "badgeId": "...",
  "expiresInSeconds": 300,
  "downloadUrl": "https://..."
}
```

### Download Local Badge (dev/test fallback)

- Method: `GET`
- Path: `/public/badges/download`
- Query:
  - `path`
  - `expires`
  - `sig`

### Verify QR Token

- Method: `POST`
- Path: `/verify/qr`
- Body:

```json
{
  "token": "<signed-qr-token>"
}
```

### Renderer Metrics

- Method: `GET`
- Path: `/org/:orgCode/badges/renderer/metrics`
- Guards: access token, org access

Response includes cumulative worker metrics, alert counters, and last alert metadata.

## Background Jobs

- `badge.render`: renders and stores badge artifacts.
- `badge.delivery-link-email`: creates short-lived delivery link and marks `deliveredAt`.
- `badge.render.dead-letter`: records final render failures after retries are exhausted.

## Alerting

- `BADGE_RENDER_ALERT_FAILURE_STREAK`: consecutive failures threshold for alerting.
- `BADGE_RENDER_ALERT_WEBHOOK_URL`: optional webhook endpoint receiving JSON alerts.

## Storage

- S3 mode when `S3_BUCKET` is configured.
- Local signed fallback mode otherwise (`local://` storage paths).
