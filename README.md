# EveMange Production Rewrite

This branch contains a fresh Phase 0 scaffold for a production rewrite.

## Stack Baseline

1. API: NestJS (TypeScript)
2. Web: Next.js (TypeScript)
3. Database: MySQL 8
4. Cache and queue backend: Redis 7
5. Infrastructure bootstrap: Docker Compose

## Project Structure

1. `apps/api`
2. `apps/web`
3. `packages/config`
4. `infra`
5. `sprints`

## Quick Start

1. Copy environment template:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Start infrastructure services:

```bash
npm run docker:up
```

4. Start API:

```bash
npm run dev:api
```

5. Start Web:

```bash
npm run dev:web
```

## Default Local Ports

1. Web: `http://localhost:3500`
2. API: `http://localhost:5001/health`
3. MySQL (Docker): `localhost:3307`
4. Redis: `localhost:6379`
5. MinIO API: `http://localhost:9000`
6. MinIO Console: `http://localhost:9001`
7. OTEL Collector health: `http://localhost:13133`

## Notes

1. This is a clean rewrite baseline and intentionally excludes legacy implementation code.
2. Use sprint documents in `sprints/` as execution guides.
