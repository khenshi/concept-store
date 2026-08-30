# Milestone 6 Part 2: Merchant Finance Data Model

## Scope

This part implements the persistence foundation approved in the Milestone 6 backend design. It adds no settlement calculation service, finance API, payout action, scheduler, or frontend behavior.

## Models

### `MerchantSettlement`

The settlement header belongs to one organization and merchant and stores:

- inclusive Philippine business-date boundaries;
- settlement schedule and lifecycle status snapshots;
- gross sales, commission, fixed rent, adjustments, and net payout totals;
- calculation, review, and approval actors and timestamps; and
- creation and update timestamps.

Totals use `DECIMAL(14,2)`. PostgreSQL verifies:

```text
netPayout = grossSales - commissionAmount - fixedRentAmount + adjustmentTotal
```

It also validates nonnegative calculated components and requires lifecycle actor metadata appropriate to `DRAFT`, `REVIEWED`, `APPROVED`, and `PAID`.

The database prevents overlapping date ranges for the same organization merchant through a GiST exclusion constraint. Exact period duplication also has a conventional unique constraint.

### `SettlementTermSnapshot`

Each row captures one agreement segment used by a settlement:

- source agreement and settlement;
- segment dates and schedule;
- copied fixed-rent and commission terms; and
- segment gross sales, commission, and prorated rent calculations.

The source agreement remains linked with restrictive deletion while copied values ensure historical calculations cannot change when current agreement data changes.

### `SettlementSaleItem`

This model links an immutable POS sale item to the settlement and exact agreement-term snapshot that calculated it. It also stores the included gross amount.

A globally unique `saleItemId` prevents the same completed merchant sale item from being included in two settlements. Composite foreign keys enforce that the sale item, merchant, term, settlement, and organization all share the same tenant boundary.

### `SettlementAdjustment`

Adjustments store an exact signed nonzero amount, required reason, authenticated creator, and timestamps. Positive values increase payout and negative values reduce it. Draft-only behavior will be enforced by the later finance service.

### `MerchantPayout`

The payout stores one manual payment record for a positive approved settlement:

- exact amount;
- finance-specific payout method;
- reference number and optional note;
- payment timestamp; and
- authenticated owner who recorded it.

One settlement can have at most one payout. Non-cash methods require a reference number at the database layer. The later service must atomically create this record and transition the settlement to `PAID`.

## Tenant and history protection

All finance entities carry `organizationId` and merchant-scoped records use composite foreign keys. Cross-organization combinations are rejected even if application validation is bypassed.

Financial source records use restrictive deletion. There are no cascade paths that could silently erase settlement, term, sale-attribution, adjustment, or payout history.

User relations preserve who calculated, reviewed, approved, adjusted, and paid each record. The later services must additionally confirm those users hold the required current organization roles inside the transaction.

## Enums

`SettlementStatus`:

- `DRAFT`
- `REVIEWED`
- `APPROVED`
- `PAID`

`PayoutMethod`:

- `CASH`
- `GCASH`
- `BANK_TRANSFER`
- `OTHER`

A finance-specific payout enum is intentionally separate from customer `PaymentMethod`, even though their initial values match.

## Migration

Migration: `20260830000000_add_merchant_finance_foundation`

The migration also enables PostgreSQL's `btree_gist` extension for tenant-and-merchant range exclusion. The target PostgreSQL provider must allow this standard extension before deployment.

## Explicitly deferred

- settlement period generation and validation;
- agreement segmentation and fixed-rent proration;
- sale-item claiming and calculation;
- adjustment mutations;
- lifecycle transitions;
- payout recording;
- authorization controllers and DTOs;
- finance frontend; and
- merchant finance access.

These belong to later Milestone 6 parts.

