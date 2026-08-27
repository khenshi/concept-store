# Milestone 1: Organization Invitation Links

## Scope

This part replaces the owner UI's direct member addition flow with secure, manually shared invitation links. An owner creates an invitation for a specific email address and organization role, copies the generated link, and sends it through their preferred channel.

Email delivery, merchant-business profile linking, and advanced permission configuration are not included.

## Workflow

1. An organization owner opens **Members** and selects **Invite member**.
2. The owner enters the recipient's email and selects `MANAGER`, `CASHIER`, or `MERCHANT`.
3. The system creates a single-use link that expires after seven days.
4. The owner copies and sends the link manually.
5. The recipient opens the link and signs in or creates an account with the invited email address.
6. After successful registration or sign-in, the system automatically accepts the invitation and redirects the recipient to the organization.

Creating another pending invitation for the same organization and email revokes the previous link. Existing organization members cannot be invited.

## Security rules

- Only an organization `OWNER` can create, list, or revoke invitations.
- The recipient must authenticate with the exact invited email address.
- The invitation determines the organization and role; these values are never accepted from the recipient.
- Tokens contain 256 bits of cryptographically secure randomness.
- Only a SHA-256 token hash is persisted. The usable token is returned once when the invitation is created.
- Links are single-use and cannot be accepted after expiration or revocation.
- Acceptance claims the invitation and creates the membership in one serializable database transaction.
- Invalid, expired, revoked, and previously accepted tokens use the same unavailable response to avoid disclosing token state.

## API

Owner endpoints:

- `POST /organizations/:organizationId/invitations`
- `GET /organizations/:organizationId/invitations`
- `PATCH /organizations/:organizationId/invitations/:invitationId/revoke`

Recipient endpoints:

- `GET /organization-invitations/:token` — public invitation preview
- `POST /organization-invitations/:token/accept` — authenticated acceptance

Create request:

```json
{
  "email": "manager@example.com",
  "role": "MANAGER"
}
```

The create response contains the invitation metadata and the one-time raw `token`. The frontend constructs the application URL rather than persisting a raw link on the server.

## Data model

`OrganizationInvitation` records the organization, normalized email, role, token hash, expiry, inviter, optional acceptor, and accepted/revoked timestamps. Invitation history remains available to the owner.

Migration: `20260827010000_add_organization_invitations`.

## Frontend behavior

- The Members page includes invitation creation, status history, and pending-invitation revocation.
- The creation dialog provides copy-to-clipboard behavior and explains the link's restrictions.
- The public invitation page preserves the invitation as the registration/sign-in return destination, then automatically accepts it for the matching authenticated account.
- Auth return paths are restricted to local relative paths to prevent open redirects.
- A signed-in user with the wrong email is asked to switch accounts.

## Assumptions and limitations

- Invitations expire after seven days; this is currently a fixed backend policy.
- A lost link cannot be recovered because raw tokens are not stored. The owner should create a replacement invitation.
- Sending email or SMS is intentionally outside this part; the owner shares the copied link manually.
- A `MERCHANT` membership grants the account's organization role only. Linking that account to a specific merchant business profile remains a separate, explicit workflow.
