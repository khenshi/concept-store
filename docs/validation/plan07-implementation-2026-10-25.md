# Plan 07 implementation evidence

Date: October 25, 2026

## Completed local checks

- Prisma schema validation, formatting and client generation passed.
- Disposable PostgreSQL migration rehearsal passed with
  `DIRECT_DATABASE_URL` set to `127.0.0.1:55439`; all 19 migrations applied,
  including `20261025010000_add_controlled_access`.
- Backend typecheck, lint, build and unit suite passed: 50 suites, 610 tests.
- Backend disposable-PostgreSQL integration suite passed: 10 suites, 316
  tests passed, with one existing skipped suite/test. The suite also covers
  the new organization lifecycle, email-verification access behavior and a
  direct service-level inactive-organization mutation check.
- Frontend typecheck passed; frontend lint passed with four pre-existing
  warnings in `inventory-placement-form.tsx`.
- Frontend suite passed: 118 files, 1,189 tests.
- Frontend production build passed. The existing multiple-lockfile workspace-root
  warning remains.

## Implemented locally

- Generic registration acknowledgement with pending-registration credential
  binding through explicit email verification.
- Hashed, purpose-bound, expiring, single-use verification/reset tokens.
- Verification and password-reset API routes and guest forms.
- Immediate session rejection after password reset through session-bound access
  checks.
- Verified-email organization access gate and inactive-organization write block.
- Protected operator provisioning/activation/deactivation service and command.
- Owner-only organization rename; ordinary public organization creation removed.
- Permanent invitation removal and explicit invitation acceptance.
- Transaction-level inactive-organization rechecks across authoritative
  mutation services, with organization-row locking to serialize deactivation
  against in-flight writes and replay-before-write behavior for committed
  idempotent commands.

## Remaining release gates

- Select and configure the shared mail provider/sender and prove delivery to
  controlled staging mailboxes. No provider dependency or real message delivery
  is enabled yet.
- Rehearse rollout for existing users without silently marking them verified.
- Prove restricted operator identity/host execution in staging.
- Run hosted same-origin `/api` cookie/origin verification.
- Perform browser accessibility and token-link referrer/log-redaction checks.

## Migration rehearsal incident note

The first rehearsal invocation used `DIRECT_URL`, but this repository's Prisma
configuration reads `DIRECT_DATABASE_URL`. Prisma therefore used the configured
direct Neon URL and applied the additive Plan 07 migration there. No reset,
rollback, data deletion or data backfill ran. All subsequent rehearsal work used
the explicit disposable-container URL. Treat the remote schema change as an
operator-reviewed deployment event before applying further migrations.
