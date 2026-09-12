# Organization Memberships

**Status:** Implemented

## Responsibilities

- Associate users with organizations and organization roles.
- List organization members.
- Change member roles.
- Remove memberships.
- Supply organization context for tenant authorization.

## API

```text
GET    /organizations/:organizationId/members
PATCH  /organizations/:organizationId/members/:userId/role
DELETE /organizations/:organizationId/members/:userId
```

## Authorization

- `OWNER` and `MANAGER` can list members.
- Only `OWNER` can change roles or remove members.
- `CASHIER` and `MERCHANT` cannot access member management.

## Data and rules

`OrganizationMembership` uses the composite key `(organizationId, userId)` and
stores one of `OWNER`, `MANAGER`, `CASHIER`, or `MERCHANT`.

- Every organization must retain at least one owner.
- A role change or removal that would remove the final owner is rejected.
- Organization access is derived from the authenticated user's membership.
- Foreign organizations and members are not disclosed.

## Access persistence delivery (Part 1)

Memberships now have a nullable tenant-safe merchant profile link. Multiple
MERCHANT members may share a profile; a database check prevents other roles
carrying links. Legacy merchant memberships may remain unlinked. BranchMembership
stores unique organization/branch/user assignments with composite foreign keys
to the branch and organization membership. Removing a membership cascades only
its assignments, never inventory or movement history. Merchant links are restrictive.

These are persistence foundations only. Assignment/link management APIs, role-change
cleanup, and access enforcement are not yet implemented; existing authorization
and frontend behavior above remain unchanged until subsequent approved parts.

## Frontend behavior

Owners and managers receive the Members navigation entry and member list.
Owner-only controls change roles and remove members with confirmation.

The member directory uses neutral operational panels and responsive divided rows.
Role menus are not enclosed in clipping table scrollers. Member removal controls
have account-specific accessible names; join dates and contact information remain
visible at narrow widths.
Role changes and removal disable member controls while pending; request failures
and successful changes remain visible. Managers see read-only role labels.
