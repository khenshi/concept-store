# Milestone 1: Account Deletion

## Scope

This part adds self-service personal account deletion. It is separate from removing an organization member and from deleting an organization.

## Workflow

1. The authenticated user enters their current password in Account Settings.
2. A destructive confirmation dialog explains the irreversible result.
3. The backend verifies the password.
4. Deletion is blocked if the user is the sole owner of any organization.
5. When eligible, all memberships and sessions are removed and personal identity data is anonymized.
6. The user is signed out and can no longer authenticate as that account.

## API

`DELETE /auth/me` requires a valid access token.

Request:

```json
{
  "password": "current secure password"
}
```

A successful deletion returns HTTP `204`. An incorrect password returns `401`. Sole ownership returns `409` with instructions to add another owner or transfer ownership first.

## Data retention strategy

The physical `User` row is retained as an anonymized, disabled audit identity because invitations and inventory movements may reference it. Hard deletion would destroy or invalidate important operational history.

Deletion performs the following in a serializable transaction:

- removes every organization membership
- removes every refresh session
- replaces the name with `Deleted User`
- clears the phone number
- replaces the email with a non-login tombstone address
- replaces the password hash with random unusable data
- records `deletedAt`

The former email is released and may be used for a new account later. Historical organization, merchant, inventory, invitation, and financial records are not deleted.

## Security rules

- The target user ID is derived from the verified access token.
- Password confirmation is required by the backend.
- A database-backed active-user check invalidates existing access tokens immediately after deletion.
- Refresh rejects deleted accounts in addition to removing their sessions.
- Sole-owner validation prevents organizations from being left without an owner.
- The frontend uses the shared destructive confirmation dialog and clears its in-memory session after success.

## Migration

`20260827020000_add_user_account_deletion` adds the nullable `User.deletedAt` timestamp and its index.
