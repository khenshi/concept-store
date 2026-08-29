# Milestone 5 Part 4: Sales History and Transaction Details

## Scope

This part adds read-only APIs for completed branch transactions. It provides a lightweight history list and a complete immutable transaction detail suitable for a later receipt page.

It does not add receipt rendering, printing, refunds, voids, edits, reporting dashboards, settlements, or frontend pages.

## Authorization and tenant scope

Both endpoints allow organization `OWNER`, `MANAGER`, and `CASHIER` roles.

Every query is scoped by both `organizationId` and `branchId`. A transaction ID from another organization or branch returns `404` instead of revealing that record.

Dedicated staff-to-branch access assignments do not exist yet, so current cashier access follows organization membership and the explicitly selected branch route.

## List completed branch sales

```http
GET /organizations/:organizationId/branches/:branchId/pos/sales
```

Optional filters:

- `search` — partial, case-insensitive sale-number search
- `cashierId` — exact cashier UUID
- `paymentMethod` — `CASH`, `GCASH`, `BANK_TRANSFER`, or `OTHER`
- `completedFrom` — inclusive ISO 8601 date-time
- `completedTo` — inclusive ISO 8601 date-time
- `offset` — default `0`
- `limit` — default `30`, maximum `100`

`completedFrom` must be earlier than or equal to `completedTo`. The API expects explicit ISO timestamps so the frontend can convert Philippine local date selections to unambiguous UTC boundaries.

Results are ordered by completion time and ID descending.

### Summary response

Each list row contains:

- sale identity and number;
- branch and cashier IDs;
- cashier summary;
- subtotal, discount, and total strings;
- completion time;
- item count; and
- distinct payment methods.

Item and payment details are deliberately excluded from list rows so transaction history does not load receipt-sized nested data for every result.

## Get transaction details

```http
GET /organizations/:organizationId/branches/:branchId/pos/sales/:saleId
```

The response uses the immutable checkout response and includes:

- sale and client transaction identifiers;
- branch and cashier summaries;
- exact monetary strings;
- historical product and merchant snapshots;
- line quantities and totals;
- payment methods, references, amounts, and confirmation details; and
- completion time.

Current product names, prices, merchant names, or account profile changes do not rewrite the stored transaction snapshots.

## Read-only history

Completed sales have no update or deletion endpoint in this part. Corrections, refunds, and voids require explicit audited business rules and will not be represented by silently editing historical transactions.

## Performance

The list uses offset pagination and the existing organization/branch/completion index. Payment filtering uses the payment relation and its organization/method/time index. Full nested records are loaded only for a selected sale.
