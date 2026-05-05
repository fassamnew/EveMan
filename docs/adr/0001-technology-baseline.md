# ADR 0001: Technology Baseline

## Status

Accepted

## Context

The rewrite requires a scalable, secure, and maintainable foundation across API, web, and operations.

## Decision

1. API uses NestJS with TypeScript.
2. Web uses Next.js with TypeScript.
3. MySQL 8 is the primary relational database.
4. Redis backs cache and queue.
5. Docker Compose is used for local infrastructure bootstrap.

## Consequences

1. Strong TypeScript consistency across stack.
2. Requires team familiarity with NestJS conventions.
3. Enables straightforward migration to container orchestration.
