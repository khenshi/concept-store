# Authentication and Accounts

**Status:** Implemented

## Responsibilities

- Account registration and login.
- Authenticated identity retrieval.
- Profile editing.
- Password changes.
- Account deletion.
- Personal signed-in color theme selection.
- Access-token issuance and refresh-session rotation.
- Account-owned active-session listing and selected-session revocation.

## API

```text
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me
PATCH  /auth/me
PATCH  /auth/me/theme
POST   /auth/change-password
DELETE /auth/me
GET    /auth/sessions?page=1
DELETE /auth/sessions/:sessionId
```

## Rules

- Passwords are hashed with bcrypt. New registration/change passwords require
  at least 12 characters and at most 72 UTF-8 bytes, checked by DTOs and services.
  Secrets are never trimmed, normalized or truncated. Login/current-password and
  deletion inputs retain existing compatibility; older bcrypt hashes may still
  accept equivalent prefixes. Verified recovery under Plan 07 remains pending.
- Login failures are generic; absent/deleted accounts receive a dummy bcrypt
  comparison. Registration still distinguishes duplicate emails and issues a
  session on success. Its anti-enumeration transition is explicitly pending Plan 07.
- Access tokens are short lived and contain a signed session ID (`sid`). Every
  authenticated request checks an active user and their unexpired, non-revoked
  session in PostgreSQL. Sessionless old JWTs are rejected; valid existing refresh
  sessions can rotate into bound JWTs without a schema migration or mass reset.
- Refresh tokens rotate, are stored hashed, and are transported in HTTP-only
  cookies. Direct deployments use `Path=/auth`; same-origin Next proxy
  deployments set `REFRESH_COOKIE_PATH=/api/auth` so issuance and clearing match
  the browser-visible route. Production cookies remain Secure, host-only and
  SameSite=Lax.
- Password changes atomically update the password and revoke all sessions.
  Existing session JWTs are rejected at subsequent authorization checks, not just
  expiry. Already-authorized in-flight operations are not cancelled. Concurrent
  login rechecks and locks the unchanged credential row before issuing a session.
- Account deletion requires the current password, revokes access, removes active
  memberships, and anonymizes credentials.
- A sole organization owner cannot delete their account.
- Authentication-sensitive routes use dedicated rate limits.
- Password change/account deletion each allow 5 attempts/minute per socket IP
  and authenticated account. The account limiter runs after authentication and
  uses existing bounded, expiring process-local throttler storage. No unsigned
  claims, client account IDs or forwarded headers provide account authority.
- Direct mode explicitly disables Express proxy trust. Hosted client-IP and
  cookie/proxy policies still require Plan 05; counters are not cluster-wide.
- Invalid/expired/revoked credentials return 401. Authentication DB lookup failures
  fail closed with a generic 503, not a false expired-session response.
- Authenticated users can select Graphite, Ocean, Forest, Plum, Star Admin,
  Sypher, Crextio, SBB, Wellness Teal, Stellar Dark, Corona Dark, or JustDo
  Dark. Older Pollux, Skydash, Azia, Purple, Plus Admin, and Breeze preferences
  continue to work and resolve to the nearest retained palette. The theme is
  personal to the account and is returned by registration, login, refresh,
  `GET /auth/me`, and profile/theme updates. Unknown theme values are rejected.

## Data

`User` stores account identity and credentials. `UserSession` stores hashed,
expiring, revocable refresh sessions and is deleted with its user.
`User.colorTheme` stores the selected palette, defaulting to `GRAPHITE` for
existing and new accounts. The theme endpoint updates only the authenticated
user's record.

## Frontend

The frontend provides registration, login, authenticated route protection,
logout, profile editing, password changing, and account deletion workflows.

Account Security lists active sessions in stable, server-paginated batches of 15.
Responses contain only ID, creation/expiry and a server-derived current marker;
no hashes, tokens, IPs or claimed device/activity information. Users of every role
can list/revoke only their own account sessions, independently of organizations.
Foreign/absent IDs return the same 404; an already-revoked owned ID is idempotent
204. Revoking the current session clears its refresh cookie and local signed-in
state. Selected-session confirmation, loading/error/empty states and pagination
use shared UI; no new sign-out-everywhere action was added.

Refresh retains per-client single-flight and uses origin-scoped native Web Locks
to serialize refresh-cookie rotation across cooperating tabs for the same API.
Without Web Locks only per-client coordination is available; this is not a replay
grace period. No tokens are persisted or broadcast. A 503 does not clear the
session, trigger refresh or replay a mutation. Existing single retry after an
explicit 401 is unchanged. No financial command/recovery state is intentionally
deleted by the new session controls; durable recovery remains Plan 18.

Authenticated routes share a compact neutral utility header with a workspace
home link, Philippine Standard Time on wide screens, account access at every
viewport size, and a sign-out action that announces pending state and prevents
repeat activation. Session-bound authentication applies to these routes too.

Login and registration share a neutral guest shell with a focused form, home
navigation, and a quiet contextual panel on wide screens. Shared labeled inputs
retain autocomplete and validation rules. Invalid submissions focus the first
invalid field; pending submissions are announced and prevent repeat activation.
Local invitation return paths, authenticated guest redirects, and safe fallback
navigation are preserved. Session loading and failure states use the neutral
visual system.

Account settings use shared neutral panels, explicit labeled fields, and consistent
error/success notices. Invalid submissions focus the first invalid field and never
reach the API. Pending actions prevent repeated submission. Email stays read-only;
profile normalization remains unchanged; new-password validation and immediate
session invalidation follow the rules above.

Account settings also offers an accessible radio group for complete light color
themes. Selecting a palette previews it immediately on signed-in pages, saves it
to the account, and restores the saved choice if the request fails. The
selection applies across devices and organization memberships. Public and
sign-in pages retain the Graphite brand palette.

Account deletion requires the current password in the shared `FormDialog` shell
with alert-dialog semantics, initial password focus and protected pending
dismissal. The form's initial action is outlined rather than solid red. Cancel
does not call the API and restores focus; server rejections, including sole-owner
restrictions, are shown without changing the backend's authorization rules.
