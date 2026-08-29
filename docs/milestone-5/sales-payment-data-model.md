# Milestone 5 Part 1: Sales and Payment Data Model

## Scope

This part establishes persistence for completed online POS transactions. It adds no controller, checkout service, cart, POS interface, receipt page, refund, void, settlement, reporting, or offline behavior.

Persisted sales are completed business records. Carts remain temporary client state and are not represented as draft sales.

## Transaction relationships

```text
Organization
└── Branch
    └── Sale
        ├── SaleItem → Product → Merchant
        ├── Payment
        └── InventoryMovement (SALE)
```

Every sale, item, payment, product relationship, merchant relationship, and inventory link carries or enforces the same `organizationId`. Composite foreign keys prevent records from being joined across tenants.

## `Sale`

`Sale` is the completed transaction header. It stores:

- organization and branch;
- the authenticated cashier;
- an organization-unique human-facing `saleNumber`;
- an organization-unique `clientTransactionId` for retry safety;
- exact subtotal, discount, and total snapshots;
- completion and creation timestamps.

The database requires:

```text
subtotal >= 0
discountTotal >= 0
discountTotal <= subtotal
total = subtotal - discountTotal
```

`clientTransactionId` establishes the uniqueness needed for online duplicate-submission protection and later offline idempotency. No sync endpoint or offline queue is implemented in this part.

## `SaleItem`

Each line identifies its product and merchant while preserving historical snapshots:

- product name, SKU, and optional barcode;
- merchant name;
- quantity;
- unit price;
- line subtotal;
- discount amount;
- final line total.

Current product or merchant edits therefore cannot change the meaning of an old sale. Foreign keys remain for attribution and reporting, while restrictive deletion preserves history.

Database checks require positive quantities and prices and enforce:

```text
subtotal = unitPrice × quantity
total = subtotal - discountAmount
0 <= discountAmount <= subtotal
```

## `Payment`

A sale may contain one or more payment records. Initial methods are:

- `CASH`
- `GCASH`
- `BANK_TRANSFER`
- `OTHER`

Payments store a positive exact amount, optional external reference number, confirming user, and payment timestamp. The later checkout service must verify that payment totals match the sale total and apply any method-specific reference requirements in the same transaction.

No external payment provider integration is included.

## Inventory audit integration

`InventoryMovementType` now includes `SALE`. `InventoryMovement.saleId` is nullable so existing stock-in and adjustment history remains valid, while sale deductions can reference their source transaction through a tenant-safe composite foreign key.

The checkout part must create the sale, items, payments, inventory quantity changes, and `SALE` movements atomically. This part does not yet perform those writes.

## Money and currency

All monetary fields use PostgreSQL `DECIMAL(14,2)`, never floating point. The current product is Philippines-focused and treats values as Philippine pesos. Multi-currency support is not part of Milestone 5.

## Important application rules reserved for later parts

The checkout APIs must still enforce:

- authenticated organization and branch access;
- allowed owner, manager, and cashier roles;
- active, sellable products participating in the selected branch;
- server-authoritative product prices, merchant ownership, and totals;
- nonempty carts and normalized line aggregation;
- payment sufficiency and method-specific validation;
- atomic inventory deductions and immutable movement creation;
- safe handling of concurrent submissions; and
- idempotent reuse of `clientTransactionId`.

## Migration

`20260829000000_add_sales_and_payments` creates the three sales tables, manual payment enum, tenant-safe foreign keys, audit relationship, uniqueness rules, indexes, and financial check constraints.
