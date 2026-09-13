# Organization Memberships

**Status:** Implemented

## Responsibilities

- Associate users with organizations and organization roles.
- List organization members.
- Change member roles.
- Remove memberships.
- Supply organization context for tenant authorization.
- Manage explicit branch assignments and merchant-profile links.

## API

```text
GET    /organizations/:organizationId/members
PATCH  /organizations/:organizationId/members/:userId/role
DELETE /organizations/:organizationId/members/:userId
GET    /organizations/:organizationId/members/:userId/branches
PUT    /organizations/:organizationId/members/:userId/branches/:branchId
DELETE /organizations/:organizationId/members/:userId/branches/:branchId
PATCH  /organizations/:organizationId/members/:userId/merchant
```

## Authorization

- Only `OWNER` can list members, change roles, remove members, manage assignments,
  or set merchant links. Managers, cashiers, and merchants cannot use these APIs.
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

## Access management delivery (Part 2)

Owner APIs list explicit assignments (all branches for owner targets), grant/revoke
tenant-local branches idempotently with 204 responses, and set a merchant link with
a merchantId response. Owner targets reject explicit assignments. Branch/member/
merchant resolution is tenant-scoped; missing and foreign objects use 404.
Assignment commands accept no fields; unknown fields are rejected. Merchant-link
commands require a UUID v4 merchantId and a MERCHANT target membership.

Role changes require merchantId for MERCHANT and reject it for other roles. An
actual role change clears explicit assignments and sets/clears the link atomically;
same-role requests preserve assignments. Member list/role responses include nullable
merchantId. No product ownership or historical actor attribution changes.

Access mutations and membership removal lock the same tenant-local membership in
serializable transactions. Serialization conflicts return 409 with retry guidance.
The last-owner invariant remains enforced; failed writes roll back all changes.
Invitation grant acceptance is delivered in Part 3; backend resource-access
filtering and role-specific projections are delivered in Part 4.

## Backend verification (Part 5)

Backend format/lint/build, 202 unit tests, 68 HTTP tests, and 33 PostgreSQL tests
pass. The database suite passed three consecutive runs. Coverage includes grants
racing with owner promotion/member removal, merchant relinking racing with role
changes, concurrent owner demotions, fresh access after revoke/relink, and tenant-safe
query scopes. Membership raw-lock serialization/deadlock errors (40001/40P01),
including Prisma adapter metadata, now map to the intended retryable 409 response.
Other database errors retain their existing behavior. No schema/stock/frontend
behavior changes are included in this verification part.

## Owner access frontend (Part 6)

Member management loads members and invitations only for owners; other roles see
an owner-only notice without those requests. Owner controls change roles and
remove members with confirmation. Role changes explain that assignments and the
previous merchant link are cleared. Changing to MERCHANT opens a native access
dialog requiring a merchant profile in the same role command.

The access dialog loads tenant-local branch/profile choices and current assignments.
Owners have an implicit all-branches explanation instead of grant controls.
Nonowners can receive individual branch grants; revocations require confirmation.
MERCHANT links can be changed with confirmation explaining the read-access change
without changing product ownership or history. Pending writes prevent duplicate
actions and dismissal; loading, retryable failures, and success are explicit.
API responses are runtime validated. Dialog choices and lists are scroll-bounded.

The member directory uses neutral operational panels and responsive divided rows.
Role menus are not enclosed in clipping table scrollers. Member removal controls
have account-specific accessible names; join dates and contact information remain
visible at narrow widths.
Role changes and removal disable member controls while pending; request failures
and successful changes remain visible. Workspace navigation alignment is delivered
separately in Part 7.
