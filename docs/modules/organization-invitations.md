# Organization Invitations

**Status:** Implemented

## Responsibilities

- Create and list organization invitations.
- Preview an invitation through its token.
- Accept an invitation into the authenticated user's matching account.
- Revoke a pending invitation.

## API

```text
POST  /organizations/:organizationId/invitations
GET   /organizations/:organizationId/invitations
PATCH /organizations/:organizationId/invitations/:invitationId/revoke
GET   /organization-invitations/:token
POST  /organization-invitations/:token/accept
```

## Authorization

- Only organization owners can create, list, or revoke invitations.
- Preview is token-based and rate limited.
- Acceptance requires authentication and an account email matching the invite.

## Data and rules

- Invitation tokens are random and stored only as hashes.
- Invitations expire and are single use.
- Revoked, expired, or accepted invitations cannot be accepted again.
- An email already belonging to the organization cannot be invited again.
- Acceptance creates the membership and marks the invitation accepted in one
  transaction.
- Invitation errors do not disclose unavailable tenant data.

## Frontend

Owners manage invitations from the organization member workflow. A separate
token route previews and accepts invitations.

Owner invitation management uses neutral controls and explicit pending, accepted,
revoked, and expired labels. Revocation disables invitation actions while pending.
Creation opens a native modal dialog with focus restoration, scroll containment,
and pending dismissal protection. The created link shows the actual expiry date
and supports clipboard copying with a manual-copy fallback. Guest acceptance is
unchanged.
