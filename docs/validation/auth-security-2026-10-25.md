# Plan 03 staged authentication validation — October 25, 2026

Scope: independent approved Plan 03 security work. Plan 02 changes were preserved.
The implementation was committed in `638280a`; no deployment or application-
database operation was performed for this validation record. Later Plan 04–06
commits are tracked separately in the [background-agent audit](background-agent-audit-2026-10-25.md).
This is not pilot/production sign-off.

## Implemented contracts

- New registration/change passwords: existing minimum and maximum 72 UTF-8 bytes,
  validated in backend DTO/service and frontend. Legacy login/current/deletion
  behavior is preserved; pre-existing bcrypt prefix ambiguity is not repaired by
  pretending the hash reveals an original password length.
- Signed `sid` on issued JWTs, checked against active user/owned active session.
  Sessionless JWTs are rejected; valid refresh sessions rotate without data reset.
- Own-only active-session list, page size 15, safe metadata and selected revoke;
  current-session revoke clears cookie/client state. Foreign/absent UUIDs share
  404; owned already-revoked selection is idempotent 204.
- Password update/revocation is atomic; login rechecks the credential under a row
  lock. Revocation denies subsequent checks, not already-authorized in-flight work.
- Dedicated 5/minute IP and post-auth account limits for password change/deletion.
  Direct mode uses socket identity, not caller-supplied forwarded headers. Storage
  is process-local, not a distributed rate guarantee.
- Auth lookup failure is sanitized 503, distinct from invalid credentials (401).
  Frontend does not refresh, sign out or replay mutations on 503.
- Native Web Locks serialize refresh across cooperating same-origin clients for
  one API, alongside per-instance single-flight. Without Web Locks coordination
  remains per-instance; replay detection is not weakened and no tokens persist.
- Nested credential/contact/body/command/reference and exception sanitization;
  safe request serialization, token-path redaction and unknown-query-value
  redaction. Production configuration rejects Swagger and SQL parameter logging.
  Static safe log messages remain a call-site responsibility, not a secret scanner.

## Local gates

- Backend full unit suite: 46 suites, 594 tests passed.
- Backend full HTTP suite: 9 suites, 274 tests passed, including direct-mode
  forwarded-IP spoofing, session authorization and captured production logging.
- Frontend full suite: 117 files, 1,189 tests passed at the initial integration gate.
- Backend full TypeScript, lint, build and Prisma validation passed.
- Frontend typecheck, lint and webpack production build passed. Lint retains four
  existing unused-variable warnings in inventory-placement-form.tsx; build retains
  the existing multiple-lockfiles/workspace-root warning.
- The initial PostgreSQL integration command exposed four stale repository
  contracts (default list-limit expectations and the pre-existing SpaceOccupancy
  migration fixture). They were repaired later in `6bbb9c7`; the subsequent
  repository record is 315 passed and 1 skipped. That later result is Plan 06
  evidence, not additional Plan 03 security proof.

## Isolated PostgreSQL proof

Created only `concept-store-plan03-20261025` (PostgreSQL 17) on loopback with a
synthetic database `concept_store_plan03_test`. Explicit read-only identity check
confirmed the expected name and zero public tables before any writes. Tests use
an explicit TEST_DATABASE_URL, isolated random schemas and synthetic accounts;
no ambient application credentials were used. Existing migrations were also
deployed only to this disposable target for attempted local browser verification.

Nine focused real-DB tests passed: sessionless cutover/refresh/logout, owned/foreign
metadata and revocation, legacy bcrypt compatibility, refresh-vs-revoke,
refresh-vs-password change, old-hash login after credential change, login-first
row-lock ordering, stale replay/deletion and transaction rollback on failed revoke.

## Remaining gates

The requested independent deep review could not run because the delegated review
agent reached its usage limit. A bounded local review was completed against the
changed auth/config/frontend surfaces; this is weaker than the required independent
review and is not presented as equivalent. Its absence is not an approval.

The browser tool reported **No browser is available**. Desktop/mobile rendering,
real browser two-tab cookie rotation, keyboard/shared-device flows and deployment
origin/proxy/cookie behavior are unverified. Temporary local servers were stopped;
automatically generated frontend agent-document files were removed as out of scope.

Plan 07 still owns registration anti-enumeration/verified onboarding/reset. Plan 05
has local rewrite/cookie-path implementation, but reviewed hosted identity/cookie/
CSRF routing remains open. Plan 18 durable financial recovery and release
qualification are not implemented by this patch. Plan 03 remains active until its
required joint gates are proven; no full completion claim.
