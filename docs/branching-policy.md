# Branching Policy

## Branches

1. `major`: active rewrite line for production architecture.
2. `main`: stable integration branch.
3. `feature/*`: short-lived sprint feature branches.
4. `hotfix/*`: urgent production fixes.

## Rules

1. No direct pushes to `main`.
2. Pull request required for all branch merges.
3. At least one reviewer approval required.
4. CI and security workflows must pass before merge.
5. Squash merge by default to keep history clean.
