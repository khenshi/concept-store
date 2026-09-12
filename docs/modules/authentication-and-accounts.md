# Authentication and Accounts

**Status:** Implemented

## Responsibilities

- Account registration and login.
- Authenticated identity retrieval.
- Profile editing.
- Password changes.
- Account deletion.
- Access-token issuance and refresh-session rotation.

## API

```text
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me
PATCH  /auth/me
POST   /auth/change-password
DELETE /auth/me
```

## Rules

- Passwords are hashed with bcrypt.
- Authentication failures avoid account enumeration.
- Access tokens are short lived.
- Refresh tokens rotate, are stored hashed, and are transported in HTTP-only
  cookies.
- Password changes revoke all refresh sessions.
- Account deletion requires the current password, revokes access, removes active
  memberships, and anonymizes credentials.
- A sole organization owner cannot delete their account.
- Authentication-sensitive routes use dedicated rate limits.

## Data

`User` stores account identity and credentials. `UserSession` stores hashed,
expiring, revocable refresh sessions and is deleted with its user.

## Frontend

The frontend provides registration, login, authenticated route protection,
logout, profile editing, password changing, and account deletion workflows.

Authenticated routes share a compact neutral utility header with a workspace
home link, Philippine Standard Time on wide screens, account access at every
viewport size, and a sign-out action that announces pending state and prevents
repeat activation. Account forms and guest screens are migrated separately;
authentication/session contracts are unchanged.
