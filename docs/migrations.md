# Migration and Rollback Guide

Phase 0 uses Prisma migrations against MySQL.

## Apply Migrations

```bash
npm run db:migrate:deploy
```

## Baseline Rollback (Phase 0)

The baseline migration includes a paired rollback SQL script:

- Up: apps/api/prisma/migrations/0001_init/migration.sql
- Down: apps/api/prisma/migrations/0001_init/down.sql

Run rollback:

```bash
npm run db:rollback:baseline
```

This rollback command is intended for early-stage environment recovery where only baseline metadata has been created.

## Production Safety Note

For later phases with irreversible data migrations, use forward-fix migrations and tested backup/restore runbooks rather than destructive rollback.
