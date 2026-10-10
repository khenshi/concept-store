# Completed Plan: Branch Space Occupancy

**Status:** Completed locally October 9, 2026. Approved October 9; originally proposed October 6, 2026.

Merchant lifecycle release rule confirmed October 9, 2026.

## Purpose and boundaries

Track which merchant occupies each named physical space in a branch. An organization may leave its space catalog empty; no existing workflow requires a space. This feature is independent of products, branch inventory, POS, sales, refunds, reports, and merchant billing.

Use the existing tenant-scoped `MerchantBranch` association to establish merchant participation in a branch. A merchant may occupy several spaces in one branch. One space may have only one occupant at a time.

Excluded: rental or commercial agreements, rates, invoices, deposits, payments, floor plans, dimensions/capacity, product-to-space placement, inventory movement, sales eligibility, new roles, merchant writes, and automatic space creation.

## Data and invariants

- Add a branch-owned `Space` with `id`, `organizationId`, `branchId`, unique branch-local name, customizable type label (for example, Rack or Shelf), `ACTIVE`/`ARCHIVED` status, and timestamps. Trim and validate names/types; compare names case-insensitively within a branch. A type is a label on each space, not a separate global catalog or enum.
- Add a dated `SpaceOccupancy` record with `id`, `organizationId`, `branchId`, `spaceId`, `merchantId`, `startedAt`, optional `endedAt`, timestamps, and the owner actor IDs for assignment/release. `endedAt = null` means currently occupied. Keep closed records as history. Do not delete a space or occupancy record through the API.
- Tenant-safe composite foreign keys must keep a space, branch, merchant, and merchant–branch association in the same organization and branch. Index branch space listing, merchant occupancy listing, and chronological history. Enforce at most one open occupancy per space with a database constraint. Prevent overlapping dated intervals for a space, including backdated records, at the database or transaction boundary so concurrent requests cannot double-book it.
- Use half-open intervals `[startedAt, endedAt)`; require `endedAt > startedAt`. Dates are UTC timestamps through the API and shown in the user's local time. Assignment/release defaults to the action time, while owners may enter past start/end timestamps to record prior occupancy. Future starts and ends are outside this plan. A backdated closed interval must not overlap any existing interval. A backdated open interval must not overlap an existing interval and becomes the current occupant.
- Only an `ACTIVE` space can receive a new assignment. Archiving requires it to be unoccupied; existing history remains readable. Reactivation is allowed if the name still satisfies uniqueness. Renaming or changing a type does not rewrite historical occupancy records; history uses the space identity and current label.
- Creating an occupancy requires an `ACTIVE` merchant–branch association and an `ACTIVE` merchant profile. A merchant's space assignment does not itself grant branch access or affect participation status.

## Workflow and consistency

- Owners create/edit/archive/reactivate spaces and assign/release merchants. Assignment can create an open occupancy or a closed historical interval. Release closes an open occupancy at the entered past or current timestamp, subject to interval validity. A move is a release followed by assignment; both should succeed or fail together when offered as one UI action.
- Changing a merchant–branch association to `INACTIVE` automatically closes all its open occupancies in that branch at the status-change time, in the same transaction. Existing closed history remains. Reactivation does not restore old occupancy; an owner assigns spaces again. Repeating an inactive status request must not create extra history or change earlier release times.
- Changing a merchant profile to `INACTIVE`, `SUSPENDED`, or `ENDED` automatically closes all its open occupancies across every branch in the organization at the status-change time, in the same transaction. Retain the release actor and reason in history. Returning the merchant to `ACTIVE` does not restore assignments. Repeated status requests or subsequent changes between non-active statuses do not alter closed intervals or create duplicate history.
- Coordinate occupancy writes, space archive, participation deactivation, and merchant lifecycle changes with consistent row-lock order and transactional checks. Assignment must recheck merchant and participation status inside the transaction so it cannot race an automatic release. Return a clear conflict for an occupied/overlapping space or a stale status. Foreign-tenant and inaccessible IDs behave like absent IDs.
- Branch `INACTIVE` is currently metadata only. It does not automatically release occupancies or change this workflow.

## API and authorization

- Under `/organizations/:organizationId/branches/:branchId/spaces`, provide scoped list/create and per-space read/update/status routes; provide occupancy history and assignment/release routes. Under `/organizations/:organizationId/merchants/:merchantId/spaces`, provide the merchant-centered current/history read projection. Final route names and DTOs must be documented in OpenAPI before implementation.
- Owners manage and read all spaces in their organization. Assigned managers read spaces and occupancy only in their assigned branches. Linked merchant members read only their own current and historical occupancy in associated branches; they cannot see other merchants' occupancy, space availability across the branch, or assignment controls. Cashiers have no space access.
- Enforce role, active membership, branch assignment/profile link, tenant scope, and related-record ownership in backend services. Strict DTO whitelisting rejects unknown fields. Pagination and filters should be scoped to branch, status, type, and merchant where the reader is authorized; avoid returning merchant contacts.

## Frontend

- Add a Spaces section to branch detail with a named-space list, type, occupancy status, current merchant, and owner controls. Managers see a read-only branch view. Merchants see only their own occupancy entries from the branch context.
- Add a Spaces section to merchant profiles showing current assignments and dated history across accessible branches. Owners can assign/release from that context; managers and linked merchants have scoped read-only views.
- Provide distinct empty states for no spaces configured, spaces available, and a merchant with no assignments. Show dates and release reasons clearly, including automatic release caused by participation deactivation or merchant lifecycle changes. Existing status confirmation dialogs explain the affected occupied-space count before the owner confirms. Follow `DESIGN.md` and the existing flat operational list pattern; provide loading/error feedback, keyboard access, and responsive layouts.

## Delivery and validation

1. Confirm this plan, then implement schema/migration and backend routes/services with tenant-safe constraints and transaction ordering.
2. Add frontend API contracts and both branch and merchant views. Keep existing sales/inventory/POS routes and eligibility unchanged.
3. Test owner/manager/merchant/cashier boundaries; cross-tenant and guessed IDs; multiple spaces per merchant; exclusive occupancy; overlap and backdated dates; concurrent assignment/deactivation/archive/lifecycle changes; automatic release across all branches for each non-active merchant status; idempotent release and no restoration on reactivation; history retention; optional empty catalog; and absence of sales/inventory effects.
4. Run Prisma validation/client generation, relevant backend and frontend checks, and migration checks against an isolated PostgreSQL database. Document any baseline failures separately.
5. After implementation, update `docs/modules/` with actual schema, routes, authorization, workflows, and UI. Archive this plan only when the approved work is complete.

## Completion evidence

Implemented behavior is documented in [spaces](../../modules/spaces.md).
See [validation](../../validation/spaces-2026-10-09.md) for isolated migration,
concurrency, authorization, frontend, and browser checks. Six preexisting frontend
test failures remain documented separately. Existing databases and production
have not been migrated or deployed.
