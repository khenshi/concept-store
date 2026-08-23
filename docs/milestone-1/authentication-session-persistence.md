# Milestone 1: Authentication Session Persistence

## Scope

This part adds only the database foundation for refreshable authentication sessions:

- `UserSession` model
- user/session relationship
- refresh-token hash storage
- expiry and revocation state
- indexes for active-session and expiration queries
- PostgreSQL migration

It does not generate refresh tokens, issue cookies, change login or registration responses, implement refresh/logout endpoints, configure CORS, or change the frontend.

## Data model

`UserSession` contains:

- UUID `id`
- `userId` foreign key
- unique `refreshTokenHash`
- `expiresAt`
- nullable `revokedAt`
- `createdAt` and `updatedAt`

Deleting a user cascades to that user's sessions. Session deletion is not used for ordinary logout; revocation state is retained so session behavior remains inspectable.

The migration is `20260823010000_add_user_sessions`.

## Security decisions

Only a cryptographic hash of refresh-token secret material will be stored. A database read must not reveal a usable refresh token.

The planned opaque refresh token will contain a session identifier and independent random secret. During rotation, the session identifier locates the record and the presented secret is verified against `refreshTokenHash`. A secret mismatch on an existing session can therefore be treated as reuse and revoke that session.

Access JWTs remain stateless and are not stored in `UserSession`.

## Indexes

- `refreshTokenHash` is unique to protect against accidental token collisions.
- `(userId, revokedAt)` supports active-session lookup and future logout-all-devices behavior.
- `expiresAt` supports expiration checks and future cleanup without requiring a cleanup job in this part.

## Validation

- Prisma formatting and client generation
- Prisma schema validation
- migration deployment to a clean PostgreSQL database
- database constraint inspection
- existing lint, unit tests, end-to-end tests, and production build

## Assumptions and limitations

- One user may have multiple sessions for different browsers or devices.
- Session naming, device metadata, IP addresses, and user-agent storage are intentionally omitted because they are not required for secure rotation.
- Expired-session cleanup is deferred until actual retention volume requires it.
- Cookie lifetime and refresh-token lifetime will be defined in the session-endpoints part.
