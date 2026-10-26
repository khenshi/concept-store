# Organization Invitations

**Status:** Implemented and validated for the pilot release

## Responsibilities

- Create and list organization invitations.
- Preview an invitation through its token.
- Accept an invitation into the authenticated user's matching account through
  an explicit action.
- Revoke a pending invitation.
- Permanently remove any invitation and its access grants.
- Automatically email invitations and resend a fresh single-use link.

## API

```text
POST  /organizations/:organizationId/invitations
GET   /organizations/:organizationId/invitations
POST  /organizations/:organizationId/invitations/:invitationId/resend
PATCH /organizations/:organizationId/invitations/:invitationId/revoke
DELETE /organizations/:organizationId/invitations/:invitationId
GET   /organization-invitations/:token
POST  /organization-invitations/:token/accept
```

## Authorization

- Only organization owners can create, list, revoke, or remove invitations.
- Preview is token-based and rate limited.
- Acceptance requires authentication and an account email matching the invite.

## Data and rules

- Invitation tokens are random and stored only as hashes.
- Invitations expire and are single use.
- Revoked, expired, or accepted invitations cannot be accepted again.
- Removing an active, expired, accepted, or revoked invitation deletes it and
  its branch access grants; its link is unavailable and cannot resurrect access.
- An email already belonging to the organization cannot be invited again.
- Acceptance creates the membership and marks the invitation accepted in one
  transaction.
- Invitation errors do not disclose unavailable tenant data.

## Access persistence delivery (Part 1)

Invitations now support nullable tenant-safe merchant links and unique branch
grant records. Composite foreign keys prevent cross-tenant merchant/branch grants.
Only MERCHANT invitations may carry merchant links; legacy invitations may remain
unlinked. Grant records cascade if their invitation is deleted; branch/merchant
references remain restrictive. Invitation removal now preserves no backend
record for expired, accepted, or revoked invitations.

## Invitation access grants (Part 3)

Staff invitation creation accepts optional distinct UUID v4 branchIds (maximum 100). MERCHANT
invitations require one merchantId and reject nonempty branchIds; other roles reject merchantId. Branches and merchant
must belong to the trusted organization; foreign/absent related records return 404. Empty branch selections are allowed. Existing supported invitation roles
remain MANAGER, CASHIER, and MERCHANT; OWNER invitations remain unsupported.

Invitation and grants are created atomically after validation. Owner create/list/
revoke responses include nullable merchantId, merchant identity/status, and branch
identity grants. Public token preview still exposes only organization name, email,
role, and expiry—no branch, merchant, or contact details.

Acceptance creates membership, merchant link, staff branch assignments, and accepted
marker in one serializable transaction. Merchant acceptance inherits profile affiliations and creates no individual grants. Matching-email, expiry, revocation,
single-use, and existing-membership checks remain enforced. Failed writes roll
back the claim and membership/grants. Concurrent membership/invitation conflicts
return 409 with retry guidance. Legacy unlinked MERCHANT invitations return 409
with owner revoke/reinvite guidance before claiming the invitation.

Grants are immutable after creation; revoke/reinvite to change them. The demo
invitation's BGC grant is now applied on acceptance. After an invitation is
committed, the shared email boundary attempts delivery through Resend. A failed
or disabled provider does not roll back the invitation; the owner retains Copy
link and can manually share it. The resend endpoint is owner-only, rotates the
stored token hash and expiry atomically, invalidates the previous link, and
returns the fresh link token once. Responses report `accepted`, `failed`, or
`disabled` provider status; provider acceptance is not inbox-delivery proof.

### Verification

Backend formatting/lint/build, 187 unit tests, 60 HTTP regression tests, and
24 PostgreSQL integration tests pass. Focused coverage verifies role-dependent
fields, scoped grants, public-preview projection, configured merchant acceptance,
legacy unlinked rejection, atomic persistence, replay/revocation rejection, and
failed membership creation rollback. PostgreSQL uses isolated schemas in a
disposable test database, never application database resets.

## Frontend behavior

### Expanded backend verification (Part 5)

Current backend totals are 202 unit, 68 HTTP, and 33 PostgreSQL tests. Repeated
database runs verify one membership/grant set for simultaneous acceptance,
mutually exclusive acceptance/revocation, and rollback of membership plus claimed
invitation when the actual branch grant insert fails. Existing-member/lost-claim
and unavailable-token conditions also have focused service coverage.

Owners manage invitations from the organization member workflow. A separate
token route previews and accepts invitations.

The owner invitation modal loads tenant-local branches and merchant profiles.
Staff branch access uses a searchable custom picker with zero to 100 distinct
assignments, selected-count feedback, and a clear action; MERCHANT requires a
profile selection and shows inherited-access guidance instead of branch access.
Switching away from MERCHANT clears the link selection.
Validation runs 300 ms after input changes, immediately on blur, and again on
submit. Loading/choice failures have retry feedback; pending creation disables
fields and repeat submission. Create/list/revoke responses are runtime validated.
Invitation rows show configured branch and merchant identities. Public preview
and acceptance do not expose these additional owner-management details.

Owner invitation management uses neutral controls and explicit pending, accepted,
revoked, and expired labels. Removing a pending invitation invalidates its link;
removing any other invitation permanently deletes its invitation record.
Creation reuses the shared `FormDialog` with focus restoration, scroll containment,
and pending dismissal protection. The created link shows the actual expiry date
and supports clipboard copying with a manual-copy fallback.

Pending invitations expose a Resend action. It refreshes the expiry, updates the
row, reports provider status, and makes the new link available for manual copy.

The token acceptance page shares the neutral guest shell with login and
registration. It retains invitation preview/retry, explicit recipient and expiry,
registration and login links with the invitation return path, mismatch/sign-out
feedback, and an explicit Accept invitation action for the matching authenticated
account.
Acceptance remains guarded against duplicate requests and redirects to the
accepted organization; token and authorization behavior are unchanged.
Mismatch sign-out announces pending state, prevents repeat activation, and shows
recoverable request failures without attempting invitation acceptance.

Final access-control coverage includes loading-choice recovery without losing
the draft, required merchant selection before submit, branch/link commands,
debounced and blur validation, and pending/dismissal behavior. Public preview and
acceptance remain unchanged. Rendered QA for this milestone was explicitly waived
on September 13, 2026; automated dialog shims do not certify browser behavior.

## Merchant branch participation

See [Merchant–branch relationships](merchant-branches.md) for profile-inherited access,
active participation requirements, inactive read/history preservation, migration,
and association management. This contract supersedes individual merchant grants
and placement-derived merchant branch visibility described in earlier milestones.
