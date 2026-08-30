# Milestone 6 Part 1: Merchant Finance Design

## Status

Approved on August 30, 2026. The persistence foundation is implemented in Part 2; calculation services, APIs, and frontend behavior remain unimplemented.

## Scope

Milestone 6 will add:

- merchant settlement periods;
- merchant gross-sales calculation from completed sale items;
- fixed-rent and commission deductions;
- explicit settlement adjustments;
- review and approval lifecycle;
- payout recording; and
- immutable financial history.

It will not add refunds or voids, automated bank payouts, accounting integrations, reporting dashboards, subscription billing, offline finance, or merchant self-service before merchant users are securely linked to merchant records.

## Financial boundary

A settlement belongs to one organization and one merchant. It covers that merchant's completed sale items across all organization branches during an inclusive Philippine business-date range.

```text
Organization
└── Merchant
    ├── MerchantAgreement history
    └── MerchantSettlement
        ├── SettlementTermSnapshot[]
        ├── SettlementSaleItem[] → immutable SaleItem
        ├── SettlementAdjustment[]
        └── MerchantPayout?
```

The store's customer payments remain separate from merchant payouts. Gross customer sales must never be reported as store revenue.

## Recommended settlement periods

Periods follow the active agreement's `settlementSchedule` in Philippine business dates:

| Schedule       | Normal period                                      |
| -------------- | -------------------------------------------------- |
| `WEEKLY`       | Monday through Sunday                              |
| `SEMI_MONTHLY` | 1st–15th and 16th–last calendar day of the month   |
| `MONTHLY`      | First through last calendar day of the month       |

- Period start and end are inclusive.
- A merchant cannot have overlapping settlements.
- A draft can be generated only for a closed period; the current business day is not included.
- Creation is explicit in the initial release. No background scheduler is required.
- A period with no sales may still produce a settlement when fixed rent or an adjustment applies.

## Agreement changes inside a period

An agreement replacement may begin inside a normal settlement period under the existing agreement rules. The settlement therefore contains one immutable term snapshot for each agreement segment that overlaps its period.

For every segment:

- commission applies only to sale items completed while that term was effective;
- the agreement ID, effective dates, schedule, rent, and commission are copied into the snapshot;
- later agreement changes cannot alter an existing settlement calculation.

### Fixed-rent proration

`fixedRentAmount` represents the charge for one complete configured settlement period. A term active for only part of a period is prorated by calendar days:

```text
segment rent = fixed rent × covered calendar days ÷ calendar days in normal period
```

Each segment rent is rounded to Philippine peso centavos using decimal half-up rounding. A full-period segment receives the full fixed rent. This prevents two full rent charges when an agreement changes mid-period.

This proration rule is the approved Milestone 6 behavior.

## Server-authoritative calculation

Eligible gross sales come only from persisted `SaleItem` records where:

- `organizationId` and `merchantId` match the settlement;
- the parent sale's Philippine business date falls inside the period; and
- the sale item has not already been included in another settlement.

The backend calculates all values with Prisma/PostgreSQL decimal arithmetic:

```text
grossSales
- commissionAmount
- fixedRentAmount
+/- adjustmentTotal
= netPayout
```

- Commission is calculated per agreement term segment from that segment's gross sales.
- The frontend cannot submit gross sales, rates, rent totals, or net payout.
- Manual adjustments contain an exact signed amount and required reason. Positive values increase the merchant payout; negative values reduce it.
- Calculation uses one documented centavo rounding strategy and stores every calculated component.

## Proposed lifecycle

```text
DRAFT → REVIEWED → APPROVED → PAID
   ↑        │
   └────────┘
```

- `DRAFT`: calculated source records and adjustments may be reviewed. Recalculation replaces calculated draft lines but retains explicit adjustment intent.
- `REVIEWED`: frozen for approval. An owner may return it to draft if correction is needed.
- `APPROVED`: immutable financial obligation. It cannot be recalculated, edited, or deleted.
- `PAID`: immutable completed settlement with one recorded payout.

No transition may be skipped. Status is controlled only by dedicated backend actions, never by a generic client-provided status update.

Corrections after approval or payment are recorded as explicit adjustments in a later settlement. Finalized historical records are never rewritten.

## Negative and zero net payouts

Recommended initial behavior:

- zero or negative settlements may be reviewed and approved;
- they cannot be marked paid and do not create a payout;
- there is no automatic balance carry-forward engine;
- an owner can add a clearly explained adjustment to a later draft settlement when the business chooses to carry a balance forward.

This avoids hidden financial state while keeping every carry-forward visible and auditable.

## Payout recording

The initial payout is a record of an external/manual payment, not a payment-gateway operation.

Proposed payout fields include:

- settlement, organization, and merchant identity;
- exact payout amount copied from the approved positive `netPayout`;
- payout method: `CASH`, `GCASH`, `BANK_TRANSFER`, or `OTHER` using a finance-specific enum;
- required reference number for non-cash methods;
- `paidAt` and the authenticated owner who recorded it; and
- optional operational note.

One settlement has at most one payout in the initial milestone. Payout creation and the `APPROVED → PAID` transition occur atomically.

## Proposed persistence model

### `MerchantSettlement`

Stores tenant and merchant IDs, inclusive period dates, schedule snapshot, lifecycle status, gross sales, commission, rent, adjustments, net payout, calculated/reviewed/approved actors and timestamps, and optimistic/concurrency metadata where required.

Important constraints:

- tenant-safe merchant foreign key;
- unique organization + merchant + period start + period end;
- no overlapping periods for the same merchant, enforced transactionally and with an appropriate PostgreSQL exclusion constraint if compatible with the final migration;
- date order and exact total check constraints; and
- restrictive deletion for all financial source relationships.

### `SettlementTermSnapshot`

Stores the source agreement ID and copied effective dates, schedule, fixed rent, commission rate, segment gross sales, calculated commission, calculated rent, and segment boundaries.

### `SettlementSaleItem`

Links each included immutable `SaleItem` to its settlement and term snapshot. A unique `saleItemId` prevents the same merchant sale from being settled twice. Tenant-safe composite foreign keys prevent cross-organization linking.

### `SettlementAdjustment`

Stores a signed decimal amount, required reason, authenticated creator, and timestamp. Adjustments are editable only while the settlement is draft. Records should be preserved rather than silently overwritten when practical.

### `MerchantPayout`

Stores the immutable manual payout record. It has a one-to-one settlement relationship and tenant-safe organization and merchant relationships.

## Authorization

Initial backend permissions:

| Operation                              | Owner | Manager | Cashier | Merchant |
| -------------------------------------- | :---: | :-----: | :-----: | :------: |
| List/view settlements                  |  Yes  |   Yes   |   No    |    No    |
| Generate/recalculate draft             |  Yes  |   Yes   |   No    |    No    |
| Add/edit draft adjustments             |  Yes  |   Yes   |   No    |    No    |
| Mark reviewed / return to draft        |  Yes  |   Yes   |   No    |    No    |
| Approve settlement                     |  Yes  |   No    |   No    |    No    |
| Record payout / mark paid              |  Yes  |   No    |   No    |    No    |

Merchant access remains excluded until an authenticated user-to-merchant relationship exists. A frontend role check is never sufficient authorization.

Every query and mutation must derive organization and actor identity from authenticated context, conceal cross-tenant IDs, verify all related records belong to the organization, and re-check the actor's current role inside financially important transactions.

## Transaction and concurrency boundaries

Serializable transactions are required for:

- draft generation and recalculation;
- claiming sale items for a settlement;
- lifecycle transitions;
- final approval; and
- payout recording with the paid transition.

Database uniqueness and conditional status updates must make retries safe and prevent duplicate settlement periods, duplicated sale-item inclusion, double approval, and double payout.

## Proposed API shape

Routes remain organization-scoped:

```text
GET    /organizations/:organizationId/settlements
POST   /organizations/:organizationId/settlements
GET    /organizations/:organizationId/settlements/:settlementId
POST   /organizations/:organizationId/settlements/:settlementId/recalculate
POST   /organizations/:organizationId/settlements/:settlementId/adjustments
PATCH  /organizations/:organizationId/settlements/:settlementId/adjustments/:adjustmentId
DELETE /organizations/:organizationId/settlements/:settlementId/adjustments/:adjustmentId
POST   /organizations/:organizationId/settlements/:settlementId/review
POST   /organizations/:organizationId/settlements/:settlementId/return-to-draft
POST   /organizations/:organizationId/settlements/:settlementId/approve
POST   /organizations/:organizationId/settlements/:settlementId/payout
```

The create request supplies only merchant ID and period boundaries. Calculation inputs and lifecycle status are never client-controlled.

## Important edge cases

- agreement starts or ends during a normal period;
- agreement replacement creates multiple term segments;
- sale timestamps near Philippine midnight;
- no eligible sales but fixed rent applies;
- late POS transaction appears while a settlement is still draft;
- recalculation after source sales change before review;
- zero or negative payout;
- concurrent settlement generation for the same merchant and period;
- concurrent approval or payout attempts;
- stale role or cross-tenant IDs;
- non-cash payout without a reference;
- amount overflow and centavo rounding.

Refunds and voids do not yet exist. Their future implementation must create auditable financial effects rather than mutate settled sale-item history.

## Implementation sequence after approval

1. Add settlement, snapshot, sale-item link, adjustment, and payout schema with database constraints.
2. Implement server-authoritative draft generation and deterministic calculation tests.
3. Add draft adjustment and lifecycle APIs.
4. Add owner-only approval and payout recording.
5. Add cross-tenant, RBAC, concurrency, duplication, and financial-integrity tests.
6. Document and complete the backend security audit.
7. Build the Milestone 6 frontend only after the backend milestone is complete.

## Decisions requiring approval

Before schema implementation, confirm the recommended rules:

1. fixed rent is prorated by calendar days for partial agreement segments;
2. weekly periods are Monday–Sunday, semi-monthly periods are 1st–15th and 16th–month-end, and monthly periods follow calendar months;
3. managers prepare and review, while only owners approve and record payouts;
4. negative balances do not carry automatically and require an explicit later adjustment; and
5. one manual payout is recorded per positive approved settlement.
