# Milestone 3: Space and Assignment Data Model

## Scope

This part adds the PostgreSQL and Prisma foundation for branch-owned physical spaces and merchant space-assignment history.

It does not add space or assignment APIs, agreement entities, frontend screens, rent calculation, settlement behavior, or Milestone 4 functionality.

## Space model

A `Space` belongs to both an organization and one of that organization's branches.

| Field            | Required    | Purpose                                               |
| ---------------- | ----------- | ----------------------------------------------------- |
| `id`             | Yes         | Globally unique space identifier                      |
| `organizationId` | Yes         | Tenant boundary                                       |
| `branchId`       | Yes         | Physical branch owning the space                      |
| `code`           | Yes         | Branch-unique operational identifier                  |
| `name`           | Yes         | Human-readable space label                            |
| `type`           | Yes         | Rack, shelf, cabinet, booth, table, drawer, or custom |
| `customType`     | Conditional | Custom description used only for `CUSTOM`             |
| `status`         | Yes         | Whether the space is operationally active             |
| `createdAt`      | Yes         | Record creation time                                  |
| `updatedAt`      | Yes         | Last update time                                      |

`SpaceType` contains `RACK`, `SHELF`, `CABINET`, `BOOTH`, `TABLE`, `DRAWER`, and `CUSTOM`.

`SpaceStatus` contains `ACTIVE` and `INACTIVE`. Occupancy is deliberately not stored as a space status; it is derived from the current assignment.

The database requires a nonblank `customType` only when `type` is `CUSTOM` and requires `customType` to be null for every predefined type.

Space codes are unique within `(organizationId, branchId)`. Names are not unique because a store may use repeated descriptive labels while relying on codes for operational identity.

## SpaceAssignment model

`SpaceAssignment` preserves the history of merchants occupying physical spaces.

| Field            | Required | Purpose                                  |
| ---------------- | -------- | ---------------------------------------- |
| `id`             | Yes      | Assignment-history identifier            |
| `organizationId` | Yes      | Tenant boundary                          |
| `branchId`       | Yes      | Branch containing the assigned space     |
| `spaceId`        | Yes      | Occupied physical space                  |
| `merchantId`     | Yes      | Merchant occupying the space             |
| `startDate`      | Yes      | First effective occupancy date           |
| `endDate`        | No       | Final effective date; null means current |
| `createdAt`      | Yes      | Record creation time                     |
| `updatedAt`      | Yes      | Last update time                         |

Dates use PostgreSQL `DATE` because occupancy is effective by business date rather than a precise timestamp.

An assignment is current when `endDate` is null. The migration adds:

- a check constraint preventing `endDate` before `startDate`
- a partial unique index on `spaceId` where `endDate IS NULL`

The partial unique index is the concurrency-safe guarantee that one physical space cannot have multiple current merchants.

Historical date-range overlap is not prevented in this part. The initial API will create current assignments and explicitly end them. Backdated or future scheduling requires a separate overlap policy before being introduced.

## Tenant and branch integrity

Composite database relationships enforce the following:

- `(branchId, organizationId)` must identify a real branch for every space.
- `(spaceId, branchId, organizationId)` must identify a real space for every assignment.
- `(merchantId, organizationId)` must identify a real merchant for every assignment.

The API requires an existing `MerchantBranch` participation record before creating an assignment. This relationship is deliberately checked in the service rather than retained as a historical foreign key: `MerchantBranch` represents current participation and must be removable after all current assignments in that branch end. Tenant consistency remains protected by the assignment's composite space and merchant foreign keys.

## Deletion and history

All assignment-history foreign keys use restrictive deletion behavior. Removing a merchant, branch, or space cannot silently erase or orphan assignment history. Removing current branch participation is allowed only after the merchant has no current space assignment there and does not delete historical assignments.

Space and assignment APIs will use lifecycle updates rather than hard deletion.

## Migration

Migration: `20260824030000_add_spaces_and_assignments`

Completion correction: `20260825010000_decouple_assignment_history_from_merchant_branch`

The migration creates:

- `SpaceType` and `SpaceStatus` enums
- `Space` and `SpaceAssignment` tables
- tenant-safe foreign keys
- branch-scoped code uniqueness
- custom-type and assignment-date check constraints
- lookup indexes
- the partial unique current-assignment index

## Validation

Run from `backend/`:

```bash
npm run prisma:format
npm run prisma:validate
npm run prisma:generate
npm run build
npm run lint
npm test
npm run test:e2e
npm run format:check
```
