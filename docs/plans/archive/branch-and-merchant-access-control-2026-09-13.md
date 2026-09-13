# Branch and Merchant Access Control Plan

**Status:** Completed and verified; all eight parts reviewed and approved for commit
**Date:** September 12, 2026

## Goal and confirmed decisions

Organization membership establishes tenant access. Branch assignments and merchant
links narrow access without granting capabilities denied by role.

- Owners have implicit access to every current and future branch.
- Managers and cashiers require explicit branch assignments.
- Invitations can include branch assignments, applied during acceptance.
- Owners link each MERCHANT member/invitation to one merchant profile. Multiple
  users may represent the same profile within the organization.
- Merchants automatically see their own inventory wherever their products are
  placed, without needing explicit branch assignments. Explicit assignments may
  additionally identify branches where they are assigned, never grant access to
  another merchant's inventory.
- Merchant access is read-only: own profile, products, branch prices, quantities,
  and stock movement history. Sales visibility belongs to the later POS plan.
- Managers see only merchant/product profiles represented by placements in their
  assigned branches. Shared merchant/product creation, editing, and status changes
  become owner-only. Managers manage inventory only in assigned branches.

This milestone precedes POS. Completed inventory archives are historical records,
not implementation authorization.

## Operational defaults for final review

- Only owners manage assignments, merchant links, invitations, and branch creation.
  Managers may edit assigned branches but cannot grant themselves access.
- Existing nonowners start without assignments or merchant links; no all-branch
  backfill. Existing unlinked merchants see an access-not-configured state until
  an owner links them.
- Invitations allow zero or more distinct branch IDs for nonowners. Merchant
  invitations require one merchant ID. Owner invitations accept neither branch
  grants nor a merchant link. Managers/cashiers invited without branches remain
  organization members but cannot access branches.
- Role changes clear assignments and merchant links atomically. A change to
  MERCHANT requires a merchant ID in the same command. Owners may separately
  relink an existing MERCHANT member with confirmation; product ownership and
  historical actor attribution never change.
- Merchant lifecycle changes do not revoke read access to existing records.
  Existing active/inactive stock-write rules remain unchanged.
- Member listing becomes owner-only as well as existing owner-only mutations,
  preventing managers from inspecting organization-wide people outside their scope.
- Foreign, absent, and inaccessible objects return the same 404. Role-denied
  operations return 403; authorized filtered lists may be empty.
- Current database checks enforce access, not JWT claims or cached permissions.
  Revocation affects subsequent requests; already-authorized in-flight operations
  may complete. No real-time revocation infrastructure is introduced.

## Scope and exclusions

Depends on authentication, memberships, invitations, branches, merchant profiles,
products, inventory, and existing workspace controls.

Implement tenant-safe assignments and merchant links, invitation grants, owner
access management, authorization/filtering across existing routes, and role-aware
frontend views. Audit embedded branch summaries and relationship reads for bypasses.

Exclude POS, sales, payments, refunds, settlements, commissions, commercial
agreements, merchant writes/self-registration, branch-specific roles, custom
permissions, bulk imports, global audits, new infrastructure, and unrelated refactors.

## Persistence

### BranchMembership

Store organizationId, branchId, userId, createdAt. Unique
(organizationId, branchId, userId), index (organizationId, userId).
Composite foreign keys reference Branch (id, organizationId) and existing
OrganizationMembership (organizationId, userId). Membership removal cascades only
assignments, never inventory/history. Branch deletion stays unexposed/restrictive.

### Membership merchant link

Add nullable merchantId to OrganizationMembership with a composite foreign key
(merchantId, organizationId) to Merchant (id, organizationId), plus a lookup index.
Multiple members may share it. A database check prohibits links on non-MERCHANT
memberships. Legacy MERCHANT memberships may remain unlinked for safe migration;
new merchant invitations/role changes require a link at the API boundary.

### Invitation grants

Add nullable tenant-safe merchantId to OrganizationInvitation and a focused
InvitationBranch relation with invitation/organization/branch IDs. Add invitation
(id, organizationId) uniqueness for composite relations. Unique invitation/branch
grants and composite foreign keys prevent cross-tenant grants and orphan records.
Keep existing invitation retention and restrictive branch/merchant deletion.

Only MERCHANT invitations may carry merchant links. New merchant invitations
require them; legacy unlinked merchant invitations fail acceptance with owner
reinvite guidance rather than silently creating unconfigured access.

## Transactions and lifecycle

- Invitation creation validates all selected branches/merchant in the trusted
  tenant and persists invitation/token hash plus grants atomically.
- Acceptance preserves matching-email, expiry, revocation, and single-use checks.
  Membership, merchant link, assignments, and accepted marker commit together.
  Failed grants roll back everything. Never overwrite an existing membership.
- Acceptance/revocation races preserve single-use and revocation guarantees.
  Invitation grants are immutable after creation; revoke/reinvite to change them.
  Retain existing invitation-link delivery, with no email integration.
- Membership role/removal, assignment writes, and merchant-link writes serialize
  against the target membership to prevent invalid grants surviving concurrent
  changes. Preserve the final-owner invariant. Grants/revocations are idempotent.
- Revocation/removal/relinking never deletes stock, products, or movement actors.

## API

Owner-only access management:

~~~text
GET    /organizations/:organizationId/members/:userId/branches
PUT    /organizations/:organizationId/members/:userId/branches/:branchId
DELETE /organizations/:organizationId/members/:userId/branches/:branchId
PATCH  /organizations/:organizationId/members/:userId/merchant
~~~

Merchant-link PATCH accepts only merchantId for a MERCHANT membership.
Existing role PATCH additionally requires merchantId when targeting MERCHANT,
rejecting it for other roles. Assignment PUT/DELETE accept no body fields.
Owners do not need stored assignments and cannot receive explicit grants.

Invitation creation accepts optional distinct UUID v4 branchIds and role-dependent
merchantId. Cap branch selections at 100 per command. Reject unknown fields,
foreign tenant objects, invalid IDs, and incompatible role fields. Owner management
responses show grants/link identity. Public token preview does not expose new
branch or merchant/contact details; acceptance needs no public grant preview.

Reuse existing organization guards and focused object-access checks close to
operations. Update Swagger/runtime schemas. Do not build a generic permissions engine.

## Resource access

| Resource/action | OWNER | MANAGER | CASHIER | MERCHANT |
| --- | --- | --- | --- | --- |
| Members/invitations/access management | All tenant | Denied | Denied | Denied |
| Branch list/detail | All tenant | Assigned | Assigned | Assigned or own placement |
| Branch create | Allowed | Denied | Denied | Denied |
| Branch edit | Allowed | Assigned | Denied | Denied |
| Merchant profile read | All tenant | Represented in assigned branches | Denied | Linked profile |
| Product read | All tenant | Placed in assigned branches | Denied | Own merchant products |
| Merchant/product create/edit/status | Allowed | Denied | Denied | Denied |
| Inventory/history read | All tenant | Assigned branches | Denied | Own placements |
| Placement/price/receipt/adjustment write | Allowed | Assigned branches | Denied | Denied |

Manager visibility derives from placement existence regardless of stock/lifecycle.
A manager can place an already-visible product in another assigned branch;
unrepresented products require an owner to place them first. Search/filter/candidate
endpoints must not reveal the full organization catalog.

Product placement responses filter both product and branch visibility. Merchants
see own placements across selling branches; an explicitly assigned branch without
own products returns empty own inventory, never branch-wide counts or others' stock.
Merchant branch reads expose identity (ID/name/code), not addresses/member data.
Merchant movement reads omit actor IDs and member identity; operation, delta,
balance, reason, and timestamp remain visible for own placements.
Managers receive merchant identity/status summaries without contact details.
Own merchant profiles may include own contact details. Use explicit projections.

Audit organization context, summaries, counts, filter lookups, placement links, and
error responses for leakage. Keep organization/account identity access without
exposing unassigned branch data. All tenant queries retain organization scope.

## Frontend

Owner member management provides assignment and merchant-link dialogs, confirmed
revocation/relinking, pending protection, and feedback. Role confirmation explains
assignment clearing. Invitation modal provides branch multiselection and required
merchant selection for MERCHANT, with 300 ms input validation, immediate blur and
final submit checks. Preserve link/copy/expiry and acceptance behavior.

Managers see assigned branches and represented read-only product/merchant views.
Remove Members, Add branch, and shared catalog mutation controls. Keep assigned
branch editing/inventory controls; placement candidates obey backend visibility.

Merchants receive focused read-only own-profile/product/inventory/history views,
with no stock writes, shared catalog mutations, member identity, or branch totals.
Cashiers remain assigned-branch readers until POS.

Backend-filtered data drives navigation. Empty/unconfigured states explain asking
an owner. Scope/access changes clear stale state. Handle revoked access safely;
never replay a successful write merely because its read refresh failed.
Follow DESIGN.md, thin routes, runtime schemas, semantic HTML, accessible keyboard
focus, bounded menus, and safe pending dialog dismissal.

## Verification and documentation

Unit/HTTP tests cover every affected role/route, owners' implicit access,
assigned/unassigned staff, linked/unlinked merchants, multiple users per merchant,
automatic own-placement access, explicit empty assignments, cross-merchant/tenant
guesses, filtered catalog/placements, projections, malformed/unknown inputs,
role clearing, relinking, removal, idempotent grants, and fresh revocation checks.

Invitation tests cover role-dependent grants, foreign selections, matching email,
atomic rollback, expiry/revocation/replay, existing memberships, legacy unlinked
merchant invitations, and acceptance/revocation races.

Disposable PostgreSQL tests establish composite foreign keys, unique grants,
role/link checks, cleanup, rollback, and assignment/link versus role/removal races.
Never reset or migrate application databases for testing. Update representative
disposable seed assignments/merchant links and seed documentation.

Frontend tests cover owner dialogs/invitations, manager restrictions, merchant
read-only views, filtered responses, no actor/contact leakage, empty/revoked access,
and request-state feedback. Run Prisma format/validate/generate; backend
format/lint/build/unit/HTTP/PostgreSQL; frontend format/lint/typecheck/tests/build;
and diff checks. Rendered QA needs browser access or a new explicit waiver:
the previous milestone's waiver does not carry over.

Update memberships, invitations, branches, merchant profiles, products, inventory,
frontend experience, seed guide, and documentation index as behavior is delivered.
Module docs describe implementation only.

## Delivery and review checkpoints

1. Assignment/link/invitation-grant schema, migration, seed, persistence checks.
2. Owner access management and transactional membership lifecycle.
3. Invitation creation/acceptance grants and security contracts.
4. Existing resource authorization, filtered reads, role-specific projections.
5. Backend unit/HTTP/PostgreSQL integrity and concurrency coverage.
6. Owner assignment/link and invitation frontend.
7. Branch-scoped manager and read-only merchant frontend.
8. Frontend coverage, full verification, documentation, completed plan archive.

The user approved this plan on September 12, 2026. Implement one part at a time; stop
for user review, then commit approved scoped changes before the next part.
Preserve unrelated changes. Archive after completion, recording any explicit QA
waiver rather than claiming rendered verification passed.

## Definition of done

Unassigned staff cannot access branch data. Managers cannot inspect unrepresented
shared records. Merchants see only linked business/own inventory, never another
merchant's stock or member identity. Invitations apply access atomically.
Tenant constraints and role rules hold; stock/history behavior remains unchanged.
Applicable checks pass, module docs are accurate, and exclusions remain excluded.

## Part 1 verification record

- Added BranchMembership, membership merchant links, invitation merchant links,
  and InvitationBranch persistence with composite tenant foreign keys and indexes.
- Added SQL checks prohibiting non-MERCHANT links while retaining legacy nullable
  links. No existing member access was automatically backfilled.
- Updated disposable seed assignments, merchant link, and pending invitation grant.
- Prisma format/validate/generate, seed formatting, backend formatting/lint/build,
  171 unit tests, 59 HTTP tests, and 21 PostgreSQL tests pass.
- Applied all migrations and ran the demo seed successfully only in the disposable
  PostgreSQL 17 container. It was removed afterward; application data was untouched.
- Updated membership/invitation persistence and seed documentation. No API,
  authorization, or frontend behavior changed. Later parts implement enforcement.
- The user reviewed and approved Part 1 for commit on September 12, 2026.

## Part 2 verification record

- Part 1 was reviewed and committed as e469c43.
- Added owner-only assignment listing/grant/revoke and merchant-link APIs.
  Member listing is now owner-only; responses include nullable merchantId.
- Added strict merchant role commands, tenant-local related object checks,
  idempotent grants/revocations, and implicit owner access handling.
- Role changes clear assignments and update merchant links atomically. Membership
  access writes/removal lock the target membership in serializable transactions;
  final-owner checks remain intact and serialization conflicts return 409.
- Backend format/lint/build, 175 unit tests, 60 HTTP tests, and 22 PostgreSQL tests
  pass. PostgreSQL verifies real membership locks, idempotency, failed related
  object rollback, role clearing, relinking, and assignment cleanup on removal.
- Only a disposable PostgreSQL 17 container was used and removed afterward.
  No application database, invitation, stock, or frontend behavior was changed.
- Updated membership module documentation. Broader concurrency coverage remains
  Part 5; invitation grants/resource enforcement/frontend alignment remain later parts.
- The user reviewed and approved Part 2 for commit on September 12, 2026.

## Part 3 verification record

- Part 2 was reviewed and committed as 585fc9b.
- Added strict branch selection/merchant-link invitation fields, tenant-local
  validation, atomic grant creation, and role-dependent merchant requirements.
- Owner responses include grant identities; public preview remains unchanged.
- Acceptance applies membership/link/branches and claim atomically; legacy
  unlinked merchant invites require owner reinvitation. Concurrency errors return 409.
- Backend build, formatting, lint, and 187 unit tests pass; 60 HTTP regression
  tests pass. Added PostgreSQL acceptance/replay/revocation and rollback tests.
- PostgreSQL verification attempted September 13, 2026 could not connect because
  Docker daemon was unavailable. After Docker resumed, all 24 PostgreSQL tests
  passed, including atomic invitation acceptance, grant persistence, replay/
  revocation rejection, and failed membership creation rollback.
- Only disposable PostgreSQL 17 was used; its container and test data were removed
  afterward. No application database was migrated or reset.
- The user reviewed and approved Part 3 for commit on September 13, 2026.
  Resource enforcement/frontend changes remain later parts.

## Part 4 verification record

- Part 3 was reviewed and committed as 0b2c30d.
- Added focused branch/product/merchant/inventory query scopes and object-access
  guard checks on existing resource endpoints. Trusted membership context now
  includes the current merchant link from the database.
- Managers read assigned branches and represented catalog records only; shared
  merchant/product mutations and branch creation are owner-only. Placement candidate
  checks prevent unrepresented product discovery or placement by managers.
- Linked merchants read own profiles/products/placements across selling branches
  and explicitly assigned branches, without another merchant's records. Unlinked
  merchants receive no catalog/branch data. Cashier inventory/catalog denial remains.
- Merchant branch responses contain identity only; merchant history omits actor
  IDs. Manager merchant summaries/search do not expose or search contact fields.
  OpenAPI describes reduced responses. Existing organization/account reads contain
  no branch summaries or counts and require no expansion.
- Backend formatting/lint/build, 191 unit tests, 62 HTTP tests, and 25 PostgreSQL
  tests pass. Actual database coverage verifies assigned filtering, inaccessible
  branches/unplaced products, automatic own placements, contact/actor projections,
  and cross-merchant read rejection.
- Only disposable PostgreSQL 17 was used and removed afterward; no application
  database migration/reset or stock behavior change occurred.
- Updated affected module documentation. Frontend alignment remains Parts 6–7;
  expanded backend integrity/concurrency coverage remains Part 5.
- The user reviewed and approved Part 4 for commit on September 13, 2026.

## Part 5 verification record

- Part 4 was reviewed and committed as 27c5237.
- Expanded query-scope and strict member DTO tests, HTTP authorization/denial
  tests, invitation service edge cases, and PostgreSQL lifecycle race coverage.
- Verified grants versus promotion/removal, links versus role changes, final-owner
  preservation, simultaneous acceptance, acceptance/revocation, fresh revoke/relink
  reads, and actual grant-insert failure rolling back membership and invitation.
- Repeated races exposed raw SELECT FOR UPDATE serialization errors surfaced as
  Prisma P2010 with adapter originalCode 40001. Corrected membership conflict mapping
  for 40001/40P01 in direct or adapter metadata; regression tests cover adapter errors.
  This fixes an existing intended 409 contract, without expanding business scope.
- All 33 PostgreSQL tests passed on three consecutive runs; all 68 HTTP tests pass.
  Final backend formatting/lint/build and all 202 unit tests also pass.
- Only disposable PostgreSQL 17 was used. No application database or schema change,
  stock change, invitation business expansion, or frontend change was introduced.
- The disposable container and test data were removed after verification.
- The user reviewed and approved Part 5 for commit on September 13, 2026.
  Unrelated root package/performance-audit changes
  were preserved and remain outside this part.

## Part 6 verification record

- Part 5 was reviewed and committed as 5be779b.
- Added owner-only access dialogs for branch grants, confirmed revocations,
  merchant relinking, and required merchant selection during role changes.
- Added invitation branch selection and role-dependent merchant selection,
  300 ms input validation, immediate blur/final checks, runtime response schemas,
  loading/retry feedback, and pending duplicate/dismissal protection.
- Updated membership, invitation, and frontend experience documentation.
- Frontend formatting, lint, type checking, all 245 tests across 52 suites,
  production build, and diff checks pass. The existing multiple-lockfile build
  warning remains; unrelated root package changes were preserved.
- Manager/merchant workspace alignment remains Part 7. No POS, backend/schema,
  or unrelated root package/performance-audit changes are included.
- Rendered browser QA has not been performed; a new waiver or browser access is
  still required at the final verification checkpoint.
- The user reviewed and approved Part 6 for commit on September 13, 2026.

## Part 7 verification record

- Part 6 was reviewed and committed as 8253465.
- Aligned navigation and controls: Members and shared catalog/branch creation are
  owner-only; managers retain assigned branch editing and inventory writes.
- Added merchant read-only own profile/products/placements/inventory/history views,
  identity-only branch screens, own-placement counts, and empty-access guidance.
- Runtime schemas parse reduced manager merchant and merchant branch/history
  responses, stripping contact/address/actor fields where restricted.
- Organization/role/resource changes reset screen state. Access refresh clears
  branch cache; obsolete responses cannot repopulate prior scope. Stock/price
  access denial clears placement data and write controls. Successful writes retain
  read-only refresh retry, without replaying successful stock commands.
- Frontend formatting, lint, type checking, all 261 tests across 52 suites,
  production build, and diff checks pass. The existing multiple-lockfile warning
  remains unrelated and nonblocking.
- Updated branches, merchant profiles, products, branch inventory, and frontend
  documentation. No backend/schema, POS/payment, or unrelated root package/audit
  changes were introduced. Final full verification/archive remains Part 8.
- Rendered browser QA has not been performed; a new waiver or browser access
  remains required at the final checkpoint.
- The user reviewed and approved Part 7 for commit on September 13, 2026.

## Part 8 final verification record

- Part 7 was reviewed and committed as fba0ae5.
- Expanded frontend coverage for implicit owner access, cancelled merchant relinks,
  access-choice loading recovery, required merchant invitation links, and draft
  preservation. All 266 tests across 52 suites pass.
- Prisma format/validate/generate, backend format/lint/build and 202 unit tests,
  68 HTTP tests, frontend format/lint/typecheck/build, and diff checks pass.
- All 33 PostgreSQL integrity/concurrency tests pass against disposable PostgreSQL
  17. HTTP tests initially lacked sandbox permission to bind local ports; their
  permitted rerun passed. No application database was migrated or reset.
- Removed the disposable container/test data after verification. Image cache
  remains available. Root package/performance-audit changes were preserved.
- Updated module docs, organization navigation documentation, seed guide, and
  documentation index; archived this completed implementation record.
- The user explicitly waived rendered browser QA for this milestone on September
  13, 2026. Viewports (320/768/1024/1440), 200% zoom, actual modal/top-layer focus,
  menu/input layout, contrast, and rendered reduced-motion checks were not run.
  Automated tests do not certify rendered accessibility or responsive behavior.
- The existing Next.js multiple-lockfile warning is nonblocking and unchanged.
  No POS/payment or other excluded feature was added. The user reviewed and
  approved Part 8 for commit on September 13, 2026. This archive never authorizes
  new implementation.

## Deferred POS decisions (not implementation scope)

Later POS: exact SKU/barcode input adds on Enter, repeated codes increase quantity,
and ambiguous matches show a choice. Cash/manual GCash/card, one method per sale,
cash tender/change, required noncash reference without provider verification.
No price overrides; price changes require total review. Cashiers view own sales;
managers only assigned branches, owners all tenant sales. Merchant sales access
will be designed separately. Completed sales immutable; refunds/voids excluded.
Browser-print internal receipts are not fiscal/tax-invoice functionality.
A separate approved POS plan is required.
