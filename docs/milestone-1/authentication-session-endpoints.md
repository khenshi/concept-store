# Milestone 1: Authentication Session Endpoints

## Scope

This part implements refreshable backend authentication sessions:

- opaque refresh-token generation
- refresh-token hashing
- registration and login session issuance
- secure HTTP-only refresh cookies
- refresh-token rotation
- replay detection and session revocation
- logout
- exact-origin credentialed CORS

It does not implement frontend session state, authentication screens, password recovery, email verification, MFA, session-management UI, logout-all-devices, or rate limiting.

## Token model

Access tokens remain signed JWTs with a 15-minute lifetime. They are returned in response bodies and are intended to be held in frontend memory rather than browser storage.

Refresh tokens are opaque values with this internal shape:

```text
session UUID.random 32-byte secret
```

The random secret is encoded with Base64URL. Only its SHA-256 hash is stored in PostgreSQL. The raw refresh token is sent only through the HTTP-only cookie and is never included in JSON responses.

Refresh sessions have a fixed lifetime configured by `REFRESH_TOKEN_TTL_DAYS`, defaulting to 30 days. Rotation changes the random secret but does not extend the original expiration time.

## Cookie policy

The cookie is named `concept_store_refresh` and uses:

- `HttpOnly`
- `SameSite=Lax`
- `Secure` in production
- path `/auth`
- expiration matching the database session

The cookie is host-only because no explicit domain is configured. This supports localhost development and same-site frontend/backend deployments without exposing it to unrelated domains.

## Endpoints

### `POST /auth/register`

User and initial refresh session creation occur in one database transaction. The JSON response remains the access token and public user identity. A refresh cookie is also issued.

### `POST /auth/login`

Valid credentials create a new independent session, allowing multiple browsers or devices. The endpoint returns an access token and sets the refresh cookie.

### `POST /auth/refresh`

Reads the HTTP-only refresh cookie, verifies the current secret hash, rotates the secret atomically, replaces the cookie, and returns a new access JWT.

Missing, malformed, expired, revoked, or invalid sessions all return the same HTTP `401` response.

If a valid session ID is presented with an old or altered secret, the session is revoked. This prevents a token thief and legitimate browser from continuing to rotate the same session independently. A concurrent refresh conflict is handled with the same conservative revocation behavior.

### `POST /auth/logout`

Revokes the session only when both its ID and secret hash match, then clears the cookie. The endpoint returns HTTP `204` and remains idempotent when the cookie is absent or malformed.

## CORS

`FRONTEND_ORIGIN` is required and must be one exact HTTP or HTTPS origin. NestJS enables credentials only for that configured origin.

Example development configuration:

```dotenv
FRONTEND_ORIGIN=http://localhost:3001
REFRESH_TOKEN_TTL_DAYS=30
```

Production must use HTTPS so the `Secure` refresh cookie can be transmitted.

## Security decisions

- Refresh tokens are not JWTs and contain no user or role claims.
- Database access cannot recover a usable refresh token from its stored hash.
- Constant-time hash comparison is used before rotation.
- Access JWTs do not contain organization roles; authorization continues to read current membership from PostgreSQL.
- The fixed refresh lifetime prevents indefinite sliding sessions.
- `SameSite=Lax` provides cross-site request protection for the cookie-based endpoints under the intended same-site deployment.

## Validation performed

- Formatting and ESLint passed.
- All 35 unit tests passed.
- The production build passed.
- Unit tests cover hashing, expiry, rotation, replay revocation, logout revocation, cookie attributes, transactional registration, and access-token renewal.
- PostgreSQL integration verification confirmed:
  - registration and login session issuance
  - HTTP-only `SameSite=Lax` cookies
  - token rotation
  - old-token replay revocation
  - logout and rejected post-logout refresh
  - no raw refresh tokens stored in PostgreSQL
  - exact frontend origin and credential CORS headers

## Assumptions and limitations

- Frontend and backend production origins are expected to be same-site. A cross-site deployment would require revisiting `SameSite`, `Secure`, and CSRF protections.
- Rate limiting for login and refresh endpoints is deferred to a dedicated security-hardening part.
- Session cleanup, logout-all-devices, and user-visible device/session management are deferred.
- Refreshing in multiple browser tabs at exactly the same time can conservatively revoke the shared session; frontend refresh coordination will minimize this case.
