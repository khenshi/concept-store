# Plan 03: Authentication and request-boundary hardening

Date: October 23, 2026

Status: Approved for staged implementation October 25, 2026. Preserve legacy
login/current-password compatibility; limit new passwords to 72 UTF-8 bytes.
Reject sessionless access JWTs but allow valid refresh sessions to rotate into
session-bound tokens. Session UI/API is required before pilot. Registration
anti-enumeration ships jointly with 07; hosted proxy proof remains with 05.
No deployment, application DB or new dependency authorized. Plan 02 is completed
and archived in commit `76fb3f8`. Joint gates remain open: do not mark this plan
fully complete without the required 05/07 evidence.

Priority: P0 security fixes before real pilot use. Session-management API/UI is
required before pilot, as confirmed October 25.

## Implementation progress — October 25

Independent scope implemented: new-password byte validation with legacy login
compatibility, session-bound access tokens and current/selected session controls,
post-auth account/IP throttling, dependency-safe 503 handling, direct socket trust,
nested log redaction and production Swagger/SQL-parameter restrictions. No schema
or dependency change. The implementation is committed in `638280a`.

See [dated evidence](../validation/auth-security-2026-10-25.md) for actual local,
PostgreSQL and review gates. Browser connection was unavailable; no visual or
real-browser two-tab proof is claimed. This plan remains current, not fully closed.

Remaining required joint gates:

- Plan 07: generic non-session registration acknowledgement, verified onboarding,
  new-password policy for resets and atomic reset/all-session revocation.
- Plan 05: reviewed hosted proxy identity, same-origin cookie/CSRF forwarding and
  distinct-client/spoofing deployment tests. Direct mode alone does not qualify it.
- Plans 11/14: real browser/session focus, two-tab rotation and shared-device
  acceptance on the selected deployment; no automated build substitutes for it.
- Plan 18: durable unresolved financial-command recovery, without introducing a
  second recovery mechanism here.

## 1. Goal, scope and ownership

Close the observed password, request-identity, auth-error and information-disclosure
gaps. Add the approved account-owned active-session view/revocation workflow using
existing sessions. Preserve membership-derived organization/branch authorization.

Source requirements: [deployment checklist](../deployment-readiness-checklist.md),
[Authentication and Accounts](../modules/authentication-and-accounts.md) and
the confirmed module-review decisions in [the queue](pending/README.md).

Included:

- Correct handling of bcrypt's input limit and explicit existing-login compatibility.
- Registration anti-enumeration contract coordinated with verified onboarding.
- Dedicated password-change/deletion throttling and safe proxy-derived client IPs.
- Distinguish invalid authentication from unavailable authentication dependencies.
- Active-session listing/selected-session revocation with an explicit JWT policy.
- Targeted credential/token/error redaction and production API-doc exposure controls.

Excluded:

- Email delivery, verification/recovery tokens, explicit invitation acceptance,
  operator provisioning and activation implementation (07).
- Provider/domain selection, cookie path/SameSite/CSRF topology implementation (05).
- Runtime logging availability/readiness (02), database operational rollout (04),
  CI (06), access-change history (17), durable financial-command recovery (18).
- MFA, OAuth/SSO, role expansion, per-tenant permission engines, session geography,
  device fingerprinting, Redis/queues or a general audit platform.
- The outlined account-deletion confirmation change remains owned by 11.

## 2. Current source evidence and weaknesses

Inspected backend `auth.service.ts`, `auth.guard.ts`, `auth.types.ts`, auth DTOs,
`sessions/session.service.ts`, cookie service, config logging/rate-limit/Swagger,
`main.ts`, `app.module.ts` and Prisma `User`/`UserSession`. Inspected frontend auth
client/context/types/schemas and account schemas; all already have tests to extend.

1. New passwords allow 12–128 characters and are passed directly to bcryptjs.
   The installed `backend/node_modules/bcryptjs/README.md` documents a maximum of
   72 UTF-8 bytes and no implicit validation. Character limits alone are unsafe;
   long inputs sharing the effective prefix can authenticate equivalently.
2. Registration returns an authenticated session for a new email and a specific
   409 for an existing email. Merely changing the duplicate message/status while
   retaining new-account tokens still reveals account existence.
3. `AuthGuard` catches both JWT verification and its active-user DB lookup,
   translating dependency errors to 401. A DB outage can falsely invalidate a
   session and trigger unnecessary frontend refresh attempts.
4. Auth rate overrides cover registration/login/refresh/logout, not password
   change or account deletion. Global throttling runs before route guards;
   account-aware limits cannot trust an unverified token's `sub`.
5. No explicit Express trust-proxy policy is configured. Behind a proxy, client
   identity can collapse to a shared proxy address; trusting arbitrary forwarded
   headers instead would allow spoofing/bypass.
6. Access JWTs carry `sub`/`email`, not a session identity. The guard checks the
   active user, not the session. Logout/password change revoke refresh sessions,
   but an existing JWT can normally last until expiry (default 15 minutes).
7. `UserSession` already stores owner, hashed refresh secret, expiry/revocation
   and timestamps. No active-session list/delete API or account UI exists.
   Rotation uses compare-and-update and revokes on stale-secret reuse. Frontend
   refresh single-flight is instance-local, not cross-tab coordination.
8. URL sanitization redacts selected query keys but not invitation tokens embedded
   in paths. New email-token routes must not create new log leaks. Swagger defaults
   off in production but a boolean override can expose it without authentication.

Fresh drafting checks on October 23: 40 backend tests passed across auth and
logging/environment suites; 50 frontend auth/account tests passed. These tests
validate existing behavior, not the proposed protections. No DB, browser, proxy,
deployed session or penetration testing ran. Full test-source tsc failures remain
tracked by 01; these focused passes are not a replacement for that gate.

## 3. Password and registration contracts

### A. Password safety: confirmed policy

User confirmed: retain bcrypt and enforce at most 72 UTF-8 bytes for
every **new** password, retaining the existing minimum. Validate in authoritative
backend DTO/service boundaries and mirror it with browser-safe byte counting in
registration/change/reset forms. Never truncate silently, trim/normalize secrets,
count only JavaScript string length, or invent an unreviewed prehash scheme.

Do not blindly apply new-password limits to existing login/current-password/
deletion inputs. Existing hashes cannot reveal the original input's length and
cannot recover a discarded suffix. Decide a safe compatibility/reset policy with
07; test real legacy bcrypt behavior, Unicode and same-prefix ambiguity. An
existing reset permission never authorizes resetting a live pilot database.

Longer-password hashing transitions are excluded. Do not add a hashing dependency,
prehash scheme or algorithm migration. A future change requires a separate reviewed
transition; never store plaintext or attempt to recover an unknown original secret.

Test byte boundaries at 71/72/73, multibyte characters, long common-prefix inputs,
password confirmation, unchanged passwords, malformed values and bypassing UI.
Plan 07 must reuse the chosen authoritative policy for reset passwords.

### B. Registration anti-enumeration

- Define one generic, non-session-issuing acknowledgement for eligible new and
  existing email submissions, with consistent public status/shape/navigation.
  A proposed 202 response can say to check email for next steps; do not return
  user IDs, tokens, verified/account-exists flags or duplicate-email errors.
- Coordinate creation/pending verification and mail with 07. Do not ship this
  independently as a broken signup flow or pretend email was delivered when it
  failed. Detailed registration/verification contracts must be agreed before
  changing backend/frontend `AuthResponse` assumptions.
- Existing account submissions must never replace password/profile, create an
  authenticated session or alter organization membership. Internal unique-key
  races map to the same safe public result, not an account-existence leak.
- Preserve explicit validation errors for malformed input without revealing
  existence; rate-limit abuse. Avoid claiming perfectly identical network timing,
  but remove obvious response/side-effect and fast unknown-login timing oracles
  using bounded existing hashing work, not arbitrary sleeps.
- Login remains generic for wrong/absent/deleted accounts. Plan 07 defines pending
  verification UX without adding a new account-enumeration endpoint.

## 4. Session management and revocation

### Account-owned API/UI

Proposed authenticated endpoints:

| Route                              | Behavior                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `GET /auth/sessions`               | Bounded/paginated current user's non-revoked, unexpired sessions          |
| `DELETE /auth/sessions/:sessionId` | Revoke that user's selected session; 204 on authorized idempotent success |

Use the existing session relation, no organization-role/admin authority. Any
signed-in role manages only its own account sessions across workspaces. Never
accept a user/organization owner ID from the request. Foreign and absent session
IDs share 404 behavior; already-revoked own sessions can safely return 204.

Return only session ID, creation/expiry, current-session indicator and accurately
labeled rotation time if useful. `updatedAt` is not reliable last user activity.
Do not call these "devices" without evidence, expose refresh hashes, show IP/
geolocation by assumption or add tracking metadata just for a richer screen.

Add an Account Settings sessions section using existing components, showing
loading/empty/error/pending states and a clear confirmation. Revoke one selected
session only; a new sign-out-everywhere action is not implied. Identify the current
session from verified server context, not a caller-selected flag or raw token in
the response. Revoking it clears that browser's session/cookie and navigates safely,
without silently destroying an unresolved financial attempt (coordinate 18).

### JWT revocation policy: confirmed immediate subsequent-request rejection

User confirmed immediate-on-subsequent-request rejection:

- Add a signed session-ID claim to issued access JWTs; bind verified claims to an
  existing, unexpired, non-revoked `UserSession` owned by the same active user.
  Reuse the current guard's DB lookup where practical, not a new revocation cache.
- Login/refresh/registration-after-verification must issue correctly bound tokens.
  Revocation/password change/reset denies that session's tokens at subsequent
  authorization checks, not just after refresh. Do not promise cancellation of
  already-authorized in-flight operations; preserve service transaction checks.
- Define cutover for old sessionless JWTs and existing refresh sessions explicitly:
  prefer an announced reauthentication/refresh boundary, not indefinite fallback
  acceptance that bypasses the new policy. No hidden mass reset is authorized.
- Keep password update and all-session revocation atomic; deletion retains sole-
  Owner protection and audit identity. Reset behavior is integrated by 07.

Expiry-delayed revocation is not the approved target. Keep bounded token lifetimes
as an additional safeguard, not a substitute for session-state checks. Plan 07's
reset/recovery flow must use immediate subsequent-request rejection too. This
does not automatically cancel already-authorized in-flight work.

Test rotation versus revocation/password change, stale refresh
replay, deleted accounts and concurrent tabs. Define a minimal cross-tab refresh
coordination strategy if needed before enabling the new UI; do not weaken refresh
replay detection to accommodate competing tabs without reviewed evidence.

## 5. Request boundaries, errors and disclosure

### Proxy identity and throttling

- Plan 05 supplies ingress topology. Configure trust only for verified hops/
  networks and test actual request paths. Never set unrestricted `trust proxy=true`
  or parse the first forwarded IP without proving how ingress overwrites headers.
- Direct mode trusts the socket peer, not caller-supplied headers. Hosted mode
  must preserve distinct clients while preventing forged forwarding headers from
  resetting a bucket. Do not blindly reject legitimate multi-proxy chains; validate
  the reviewed topology and fail closed on ambiguous required identity.
- Keep current route limits unless measurement justifies changes. Add dedicated
  password-change/deletion limits, layered with existing IP protection. Account
  keys must derive from authenticated principal after auth, not unsigned JWTs or
  client user/tenant fields; respect Nest global-versus-route guard ordering.
- Define numeric limits and retry feedback with tests before rollout. Avoid one
  shared "unknown" bucket, raw email/IP/token logs, unbounded keys and easy reset
  through URL/UUID case variants. Abuse must not permanently lock out victims.
- Counters are process-local: restarting/multiple replicas changes aggregate
  protection. Document the initial deployment limit with 05/06; do not add Redis
  or claim cluster-wide rate guarantees without an approved requirement.

### Authentication errors

Narrow JWT rejection handling to real token/claim failures. A missing/deleted user
or revoked session is 401; DB connectivity/timeouts fail closed with a sanitized
503 (or established safe server-error contract), never fake 401/403. Do not catch
all exceptions as authentication failures. Preserve foreign-object 404 semantics.

Frontend must keep service-unavailable recovery separate from expired sessions:
no sign-out/refresh storm on 503, no silent privileged stale data and no mutation
auto-retry. Keep current explicit financial command recovery; do not create a
second generic API retry policy. Logs retain safe request correlation via 02.

### Redaction and API docs

- Sanitize credential/token query parameters **and token-bearing URL paths**, plus
  request bodies, cookies, authorization headers and nested exception context.
  Do not rely on client-friendly messages as server-side disclosure protection.
- Test signup/login/invitation and future 07 recovery/verification paths with
  synthetic secrets, including failed requests. No stored commands, references,
  contacts, DB URLs or JWT secrets in log output or public stack traces.
- Keep production DB query parameters off; define validation that cannot casually
  re-enable them. Preserve safe nonproduction diagnostics without shipping secrets.
- Keep Swagger UI and raw JSON absent in production unless a separate protected
  access policy is approved; an environment boolean alone is not authorization.
  No new platform-admin authentication system is implied for documentation.

## 6. Data, compatibility and implementation sequence

1. Capture baseline/decisions; inspect existing schemas, fixtures and full errors
   under 01. Do not treat mock test success as actual access revocation proof.
2. Implement narrow dependency-error/redaction/rate-boundary fixes with focused
   regression tests. Coordinate logger output with 02 and ingress contract with 05.
3. Implement the chosen new-password policy and legacy/reset compatibility with 07. No forced account/data reset or new hashing package without approval.
4. Implement session API/UI and chosen JWT policy in bounded steps. Existing
   UserSession fields are sufficient for minimal metadata; add schema only if a
   proven invariant requires it. Specify additive migration/backward-compatible
   application order and rollback if any schema changes are approved.
5. Deliver registration anti-enumeration atomically with 07's verified onboarding
   contract, updating frontend types/runtime schemas and tests together. Do not
   leave the register form expecting access tokens from a generic acknowledgement.
6. Run actual isolated DB tests for rotation/revocation/password races and safe
   upgrade. Run browser/session and deployed proxy/origin checks with 05/11/14.
7. Obtain independent deep security review before implementation sign-off; resolve
   findings and document remaining operational limitations. No code is implemented
   or independently reviewed by creating this draft.

Existing roles and tenant tables do not change. Session ownership is account-
scoped; organization membership/grants remain freshly enforced by their existing
guards/services. Session API access never grants a tenant/branch or platform role.

## 7. Verification and acceptance

Run installed tools from `backend/`:

```sh
npm test -- --runInBand src/modules/auth src/config/logging.spec.ts src/config/env.validation.spec.ts
npm test -- --runInBand
npm run test:e2e -- --runInBand
npx tsc --noEmit --incremental false
npm run lint
npm run build
npm run prisma:validate
```

From `frontend/`:

```sh
npm test -- --run src/features/auth src/features/account
npm test -- --run
npm run typecheck
npm run lint
npm run build
```

Add focused DTO/service/HTTP and browser coverage for the proposed contracts.
If schema changes are needed, use Prisma validate/generate and rehearsal on a
separately verified disposable target under 04; never ambient application DB URLs.
Run changed-file formatting and inspect diff; preserve unrelated user edits.

Required proof:

- All password byte/Unicode/legacy cases and chosen reset policy; no silent
  truncation, changed-secret equivalence or accidental legacy lockout.
- New/existing/concurrent registration has the same public acknowledgement, no
  unauthorized sessions/account overwrite and a working 07 verification path.
- Own/foreign/revoked/expired sessions, current-session revocation, fresh logout/
  password/reset behavior and any old-token cutover match the chosen policy.
- Real DB races: rotation/revocation/password change and deleted-user access;
  failed writes do not leave partial credential/session changes.
- Two clients behind ingress have independent intended limits; direct/forwarded
  spoofing, multiple hops, NAT load and route/account-limiter ordering are tested.
- DB outages never authenticate users or masquerade as invalid sessions; frontend
  retains explicit safe recovery without mutation replay or refresh loops.
- Captured production logs/errors/Swagger paths reveal no synthetic secrets or
  private records, while deliberate safe operational errors still appear.
- Existing role/tenant/branch and last-Owner protections stay green. Browser
  focus, confirmation and shared-device/sign-out recovery are tested, not assumed.

Record local, real-DB, browser, ingress/deployed and review evidence separately.
No unrun gate is waived by build/unit success. Update
`docs/modules/authentication-and-accounts.md`, runtime docs where affected, API
contracts and checklist only after implementation. Roll back only task-owned
changes; don't restore vulnerable fallback behavior as an unexamined workaround.

## 8. Decisions, risks and dependencies

Confirmed by the user on October 23:

1. Keep bcrypt with a 72-byte UTF-8 limit for new/change/reset passwords. Existing
   login/current-password compatibility still needs a deliberate policy, not
   silent truncation or accidental lockout.
2. Reject revoked-session JWTs on subsequent requests immediately, including after
   password change/reset; do not wait for expiry. Define an explicit old-token
   cutover and preserve already-authorized in-flight-operation safety limits.

October 25 implementation decisions: password-change and deletion each use
5/minute per IP plus 5/minute per verified account; existing login is preserved;
old sessionless JWTs are rejected, valid refresh sessions can rotate; minimal
session metadata is ID/creation/expiry/current marker with 15-row pagination.
Owner-approved staged delivery requires session API/UI before pilot. Verified
registration/07, safe hosted proxy topology/05 and operational privacy/retention/13
remain joint gates, not guessed or waived by this implementation.

Dependencies are intentionally staged: 02 owns logging availability, 03 owns safe
disclosure; 05 supplies proxy/cookie topology, 03 implements trusted request
identity; 07 owns mail/verified onboarding and consumes password/revocation policy.
Agree these interfaces before code; do not require 07 to be deployed to start
03's independent P0 fixes. 06/14 must refuse launch if required joint gates remain.

Primary risks: unsafe password migration, claiming immediate JWT revocation
without binding sessions, anti-enumeration copy with distinguishable token output,
multi-tab refresh false positives, spoofable/shared rate buckets, and newly
enabled logs leaking secrets. No new financial or permission module solves these;
use focused contracts, compatibility tests and deep review.
