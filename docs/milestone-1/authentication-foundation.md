# Milestone 1: Authentication Foundation

## Scope

This part adds standalone user identity and authentication:

- user registration with email and password
- secure password hashing
- login with short-lived JWT access tokens
- a protected endpoint for retrieving the authenticated identity

It does not implement organizations, organization membership, roles, permissions, branches, tenant context, refresh tokens, password recovery, email verification, or account administration.

## Database model

`User` contains:

- UUID `id`
- unique normalized `email`
- `passwordHash`
- `createdAt` and `updatedAt` timestamps

Passwords are never stored or returned in plaintext. The initial migration is `20260819000000_add_user`.

## API

### `POST /auth/register`

Creates a standalone user and returns an access token. The request body is:

```json
{
  "email": "owner@example.com",
  "password": "a password with at least 12 characters"
}
```

Emails are trimmed and converted to lowercase. Passwords must contain 12–128 characters. Duplicate email addresses return HTTP `409`.

### `POST /auth/login`

Authenticates an existing user and returns the same response shape as registration:

```json
{
  "accessToken": "...",
  "user": {
    "id": "...",
    "email": "owner@example.com"
  }
}
```

Unknown accounts and incorrect passwords both return the same HTTP `401` message to avoid revealing whether an email is registered.

### `GET /auth/me`

Requires `Authorization: Bearer <access-token>` and returns the authenticated user's `id` and `email`.

## Security decisions

- Passwords are hashed with bcrypt using cost factor 12.
- JWTs expire after 15 minutes.
- `JWT_SECRET` is required at startup and must contain at least 32 characters.
- JWT payloads contain only the user ID (`sub`) and email.
- Password hashes are selected only during credential verification and never included in API responses.
- Request DTOs use the application's global whitelist and validation rules.

Access tokens are intentionally the only session mechanism in this part. Refresh-token storage, token revocation, and session management require additional persistence and policy decisions and remain out of scope.

## Configuration

Add a unique cryptographically random value to `backend/.env`:

```dotenv
JWT_SECRET="a-unique-random-secret-containing-at-least-32-characters"
```

Apply database migrations before starting the backend:

```bash
cd backend
npm run prisma:migrate:deploy
```

## Validation

This part includes unit tests for registration, password hashing, successful and failed login, JWT issuance, bearer-token validation, and authenticated request identity. Database migration and HTTP endpoint behavior are also verified against PostgreSQL during implementation.

## Assumptions and limitations

- Registration is open because invitation and organization onboarding policy has not yet been assigned.
- Registration creates only a user identity; it does not create an organization or grant a role.
- Rate limiting, password reset, email verification, MFA, and refresh tokens are not included in this part.

Refresh sessions were subsequently added in [Authentication session persistence](authentication-session-persistence.md) and [Authentication session endpoints](authentication-session-endpoints.md).
