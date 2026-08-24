# Milestone 3 Backend Design — Spaces and Agreements

## Goal

Milestone 3 represents where merchants physically operate and the commercial terms governing their relationship with the concept store.

The backend will add:

- branch-owned physical spaces
- current and historical merchant space assignments
- exclusive current occupancy per space
- merchant agreement history
- fixed-rent, commission-only, and hybrid terms
- weekly, semi-monthly, and monthly settlement schedules
- owner and manager management APIs
- organization isolation and database constraints

The backend remains a modular NestJS monolith using PostgreSQL and Prisma.

## Explicit exclusions

This milestone does not implement products, inventory, POS, settlement calculation, payout processing, reporting, offline functionality, subscription billing, or the Milestone 3 frontend.

Agreement records define future settlement inputs, but this milestone does not calculate amounts owed.

## Domain separation

Three relationships remain distinct:

```text
MerchantBranch
  Merchant currently participates in a branch

SpaceAssignment
  Merchant occupies a specific physical space in that branch

MerchantAgreement
  Commercial terms between the organization and merchant
```

Branch participation does not imply physical occupancy. A merchant may participate in a branch before receiving a space or between assignments.

Space assignment does not itself define commission or total merchant rent. Commercial terms belong to agreement history so later settlements can reference a stable agreement record.

## Physical spaces

### Space

| Field            | Type          | Purpose                                       |
| ---------------- | ------------- | --------------------------------------------- |
| `id`             | UUID          | Space identifier                              |
| `organizationId` | UUID          | Tenant boundary                               |
| `branchId`       | UUID          | Physical branch owning the space              |
| `code`           | string        | Required branch-unique operational identifier |
| `name`           | string        | Required human-readable label                 |
| `type`           | `SpaceType`   | Physical format                               |
| `customType`     | string/null   | Required only when type is `CUSTOM`           |
| `status`         | `SpaceStatus` | Whether the space can be used operationally   |
| `createdAt`      | timestamp     | Creation time                                 |
| `updatedAt`      | timestamp     | Last update time                              |

Initial `SpaceType` values:

- `RACK`
- `SHELF`
- `CABINET`
- `BOOTH`
- `TABLE`
- `DRAWER`
- `CUSTOM`

Initial `SpaceStatus` values:

- `ACTIVE`
- `INACTIVE`

Occupancy is not stored as a space status. It is derived from the current assignment, preventing status and assignment data from disagreeing.

Space codes are unique within a branch, not across the whole organization. Composite tenant keys ensure a space and its branch always belong to the same organization.

Spaces are not hard-deleted through the API. Inactive spaces remain available to assignment history.

## Space assignments

### SpaceAssignment

| Field            | Type      | Purpose                                  |
| ---------------- | --------- | ---------------------------------------- |
| `id`             | UUID      | Assignment-history identifier            |
| `organizationId` | UUID      | Tenant boundary                          |
| `branchId`       | UUID      | Branch context                           |
| `spaceId`        | UUID      | Occupied physical space                  |
| `merchantId`     | UUID      | Assigned merchant                        |
| `startDate`      | date      | First effective occupancy date           |
| `endDate`        | date/null | Final effective date; null means current |
| `createdAt`      | timestamp | Record creation time                     |
| `updatedAt`      | timestamp | Last record update time                  |

An assignment is current when `endDate` is null. Assignment state is derived from dates rather than duplicated in a status column.

### Assignment invariants

- A space can have at most one current assignment.
- Assignment history is retained when occupancy ends.
- `endDate` cannot precede `startDate`.
- A new assignment requires an active space.
- The merchant must already participate in the space's branch through `MerchantBranch`.
- Space, branch, merchant participation, and assignment must share one organization.
- Ending and replacing an assignment are explicit operations; historical rows are not overwritten for a different merchant.

PostgreSQL will enforce one current assignment per space with a partial unique index on `spaceId` where `endDate IS NULL`. Composite foreign keys will enforce tenant and branch consistency, including a reference from the assignment to the matching `MerchantBranch` relationship.

The initial rule prevents multiple open assignments. Full historical date-range overlap prevention is deferred unless backdated and future-dated assignment scheduling is introduced.

## Merchant agreements

### MerchantAgreement

| Field                | Type                 | Purpose                                   |
| -------------------- | -------------------- | ----------------------------------------- |
| `id`                 | UUID                 | Stable agreement identifier               |
| `organizationId`     | UUID                 | Tenant boundary                           |
| `merchantId`         | UUID                 | Merchant governed by the terms            |
| `startDate`          | date                 | First effective agreement date            |
| `endDate`            | date/null            | Final effective date                      |
| `fixedRentAmount`    | decimal/null         | Fixed rent for the settlement schedule    |
| `commissionRate`     | decimal/null         | Percentage of attributable merchant sales |
| `settlementSchedule` | `SettlementSchedule` | Payout-period configuration               |
| `status`             | `AgreementStatus`    | Explicit agreement lifecycle              |
| `createdAt`          | timestamp            | Record creation time                      |
| `updatedAt`          | timestamp            | Last update time                          |

Initial `SettlementSchedule` values:

- `WEEKLY`
- `SEMI_MONTHLY`
- `MONTHLY`

Initial `AgreementStatus` values:

- `DRAFT`
- `ACTIVE`
- `ENDED`

### Commercial-term rules

- Fixed-rent only: positive `fixedRentAmount`, no commission rate.
- Commission only: positive `commissionRate`, no fixed rent amount.
- Hybrid: both values are positive.
- At least one commercial value must be present and positive before activation.
- Commission rate must be greater than zero and no greater than 100.
- Money uses PostgreSQL `numeric(12,2)` through Prisma `Decimal`, never floating point.
- Commission rates use `numeric(5,2)`.
- `endDate` cannot precede `startDate`.
- Only one active agreement is allowed per merchant.
- Agreement terms are never silently overwritten after activation.

Draft agreements may be edited. Activating a replacement agreement ends the previous active agreement in the same database transaction. Ended agreement records are immutable except for corrections introduced by a future explicit administrative workflow.

Fixed rent is modeled at the merchant-agreement level for this milestone. It represents the merchant's agreed fixed charge per configured settlement schedule, not a price stored independently on every physical space assignment. Per-space rent would materially change later settlement calculations and is excluded until explicitly required.

## Authorization

All routes require authentication and stored organization membership through the existing organization access guard.

- `OWNER`: manage spaces, assignments, and agreements
- `MANAGER`: manage spaces, assignments, and agreements
- `CASHIER`: no Milestone 3 management access
- `MERCHANT`: no Milestone 3 management access yet

Merchant self-service remains excluded because merchant business records are not yet linked to user accounts.

Every query and mutation includes the trusted `organizationId`. Cross-organization identifiers return a generic unavailable/not-found result without disclosing another tenant's data.

## Module structure

```text
src/modules/spaces/
├── dto/
├── space-assignments/
│   ├── dto/
│   ├── space-assignments.controller.ts
│   ├── space-assignments.service.ts
│   └── space-assignments.types.ts
├── spaces.controller.ts
├── spaces.module.ts
├── spaces.service.ts
└── spaces.types.ts

src/modules/merchant-agreements/
├── dto/
├── merchant-agreements.controller.ts
├── merchant-agreements.module.ts
├── merchant-agreements.service.ts
└── merchant-agreements.types.ts
```

Assignments are nested under the space domain because they govern physical occupancy. Agreements remain a separate top-level business module because they govern commercial terms and will later be consumed by settlement logic.

## Planned API boundaries

### Spaces

```text
POST   /organizations/:organizationId/branches/:branchId/spaces
GET    /organizations/:organizationId/branches/:branchId/spaces
GET    /organizations/:organizationId/spaces/:spaceId
PATCH  /organizations/:organizationId/spaces/:spaceId
```

### Assignments

```text
POST   /organizations/:organizationId/spaces/:spaceId/assignments
GET    /organizations/:organizationId/spaces/:spaceId/assignments
PATCH  /organizations/:organizationId/space-assignments/:assignmentId/end
```

### Agreements

```text
POST   /organizations/:organizationId/merchants/:merchantId/agreements
GET    /organizations/:organizationId/merchants/:merchantId/agreements
GET    /organizations/:organizationId/merchant-agreements/:agreementId
PATCH  /organizations/:organizationId/merchant-agreements/:agreementId
PATCH  /organizations/:organizationId/merchant-agreements/:agreementId/activate
PATCH  /organizations/:organizationId/merchant-agreements/:agreementId/end
```

Controllers remain thin. Services own tenant-scoped lookups, business rules, and transaction boundaries.

## Transaction boundaries

- Creating an assignment verifies tenant, space status, merchant branch participation, and current occupancy before inserting.
- Ending an assignment validates its current state before setting `endDate`.
- Activating an agreement validates complete terms and ends any prior active agreement atomically.
- Database uniqueness constraints remain the concurrency-safe final enforcement layer.

## Implementation parts

1. Space and assignment Prisma schema with migration and schema documentation.
2. Space CRUD API, authorization, Swagger, and tests.
3. Space-assignment API, exclusivity enforcement, Swagger, and tests.
4. Merchant-agreement Prisma schema with migration and schema documentation.
5. Merchant-agreement API, lifecycle transactions, Swagger, and tests.
6. Milestone 3 backend completion validation and documentation.
7. Milestone 3 frontend, only after the backend milestone is complete.

Each part receives a separate review and suggested commit message. No later part begins automatically.

## Assumptions requiring approval

This design makes two business choices that affect later financial behavior:

1. Fixed rent belongs to the merchant agreement as one charge per settlement schedule, rather than separately to every space assignment.
2. A merchant can have only one active commercial agreement at a time across the organization, even when operating in multiple branches.

Schema implementation should begin only after these assumptions are accepted or revised.

Both assumptions were approved before schema implementation began.
