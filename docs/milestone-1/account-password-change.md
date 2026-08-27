# Milestone 1: Account Password Change

## Scope

This part adds password changing to Account Settings. It does not add password recovery, email changes, session-device management, or account deletion.

## Workflow

1. The authenticated user enters their current password.
2. They enter and confirm a new password of 12–128 characters.
3. The backend verifies the current password and rejects reuse of the same password.
4. The password hash is replaced and all refresh sessions are revoked atomically.
5. The current refresh cookie and in-memory access token are cleared.
6. The user signs in again with the new password.

## API

`POST /auth/change-password` requires a valid access token.

Request:

```json
{
  "currentPassword": "current secure password",
  "newPassword": "different secure password"
}
```

A successful change returns HTTP `204`.

## Security rules

- The user ID comes exclusively from the verified access token.
- The current password is verified using the stored bcrypt hash.
- The new password must differ from the current password.
- Passwords are never returned or logged.
- The new password is hashed with the same bcrypt cost used during registration.
- Password replacement and refresh-session revocation occur in one database transaction.
- Every device must authenticate again after the change.
