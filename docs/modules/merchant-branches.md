# Merchant–branch relationships

**Status:** Implemented

## Model and ownership

`MerchantBranch` records where a merchant operates: `id`, `organizationId`,
`merchantId`, `branchId`, `status`, `createdAt`, and `updatedAt`. Participation is
`ACTIVE` by default or `INACTIVE`. The organization/branch/merchant tuple is unique;
composite foreign keys prevent foreign-tenant merchants and branches. Deletion is
restrictive. Associations are retained and reactivated instead of deleted.

`BranchInventory.merchantId` is derived from product ownership by the backend.
Composite foreign keys require the product's actual merchant and an existing
association in the same organization and branch. Product/branch uniqueness remains.
Quantity, price, thresholds, movements, sales, refunds, and original-placement
restocking remain independent for each branch. Global merchant lifecycle is
separate: retained profiles may be associated regardless of their global status.
Existing global merchant/product eligibility checks still apply.

## API

| Method and path (under `/organizations/:organizationId`) | Behavior |
| --- | --- |
| `GET /merchants/:merchantId/branches` | List associated branches |
| `GET /branches/:branchId/merchants` | List affiliated merchants |
| `PUT /merchants/:merchantId/branches/:branchId` | Create active participation, or return existing association unchanged |
| `PATCH /merchants/:merchantId/branches/:branchId/status` | Set `ACTIVE` or `INACTIVE` |

Lists accept `page` (default 1), optional `q` (identity name/code, maximum 120
characters), and optional `status`. Page size is fixed at 15. Responses contain
`items`, `page`, `limit`, `total`, `totalPages`, and `hasNext`. Each item contains
association IDs/status/timestamps, branch ID/name/code, and merchant ID/name/code/
global status. Contact fields are excluded. Ordering uses related name then
association ID. PUT accepts an empty object; PATCH requires only `status`.
Unknown fields and invalid input return 400. Inaccessible, foreign, and absent
objects return the same 404.

Owners read all tenant associations and alone create/change participation.
Managers read only associations in their assigned branches. Merchants read only
associations belonging to their currently linked profile, including inactive
participation. Cashiers cannot use these endpoints. Current membership and profile
links are reloaded; frontend visibility does not authorize operations.

## Operational eligibility and concurrency

Active participation is required for placement creation, eligible-product lookup,
opening stock, receiving stock, and POS checkout. Missing or inactive participation
blocks an otherwise authorized write with `409 MERCHANT_BRANCH_INACTIVE`.
Inventory and POS projections expose `participationStatus`; POS `eligible` requires
positive stock and active participation as well as existing catalog eligibility.

Inactive participation preserves authorized inventory reads, price/threshold edits,
stock corrections, refunds, original-placement restocking, and historical reads.
No merchant write permission is introduced. Completed stock/opening-stock/checkout
commands retain their existing persisted replay behavior without additional writes.

Participation is checked inside the write transaction. Operations acquire shared
association-row locks in sorted merchant-ID order before inventory writes;
status changes acquire an exclusive lock on that association. Serializable
transactions prevent stale participation from bypassing concurrent deactivation.
Association mutation serialization/deadlock conflicts return retryable 409.

## Inherited access

All users linked to one merchant profile inherit the same associated branches,
including inactive branches for reads. Individual merchant user grants and product
placements are no longer access sources. Managers/cashiers retain user assignments.
Manager merchant visibility follows affiliated merchants in assigned branches;
product visibility includes their unplaced products, permitting initial placement.
Historical own sales and reports remain accessible independently of affiliations.
Unlinked merchants receive no operational branch access. Relinking, membership
removal, and staff grant revocation affect subsequent requests.

Owner member dialogs explain inherited merchant access. Merchant branch-grant
mutation APIs reject requests with association-management guidance. Merchant
invitations require a profile and reject nonempty `branchIds`; acceptance creates
no individual branch grants and inherits current profile affiliations. Staff
invitation grants remain supported. Branch directory `merchantCount` counts active
associations, including merchants with no inventory, and is labeled “Active merchants.”

## Frontend

Merchant profiles show a paginated Branches section; branch details show Merchants.
Owners assign unassociated identities and confirm deactivation/reactivation.
Inactive associations are excluded from assignment choices and offer reactivation.
Managers/merchants receive scoped read-only lists and inventory links. Sections use
open operational rows, native dialogs, pending protection, retry feedback, and
obsolete-response protection. Mutation refreshes current branch choices/counts.
Opening-stock choices include only active affiliations. Placement choices exclude
missing/inactive participation and owners receive assignment-management links.
Inactive inventory/POS controls explain why receiving/selling is unavailable while
correction/history actions remain accessible.

## Migration and rollout

Migration `20261001020000_add_merchant_branches` must run with application writes
paused. It creates active associations from all current placements (including zero
stock) and linked MERCHANT membership grants, deduplicates them, backfills inventory
ownership, enables constraints, removes merchant user grants, and revokes every
unaccepted/unrevoked merchant invitation. Staff grants/invitations are preserved.
Historical sales alone do not create participation. Invitation records/grants remain
under existing retention rules. PostgreSQL NOTICE reports associations created,
linked grants converted, merchant grants removed, invitations revoked, and inventory
rows backfilled.

Before reopening writes, compare pre/post quantities, prices, thresholds, movement
records/totals, sale/items, and refund/items; verify ownership and association joins,
absence of merchant user grants, and preserved staff access. Deploy matching backend
and frontend during the pause; do not run the old application after conversion.
The migration is transactional; after a committed conversion, rollback requires
restoring the pre-migration database snapshot and matching application version.

Optional named physical spaces are documented in [Branch space occupancy](spaces.md).
Deactivating participation automatically releases that merchant's open space
occupancies in the branch within the status transaction, retaining dated history.
Reactivation does not restore occupancy. Transfers, rental agreements, new roles,
and merchant writes remain excluded.
