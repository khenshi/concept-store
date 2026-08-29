# Milestone 5 Part 3: Online Checkout API

## Scope

This part completes server-authoritative persistence for a basic online POS sale. It includes manual payments, merchant attribution, inventory deduction, movement audit records, and duplicate-submission protection.

It does not include discounts, refunds, voids, receipt rendering, sales history, reports, settlements, offline queuing, or the POS frontend.

## Endpoint

```http
POST /organizations/:organizationId/branches/:branchId/pos/sales
```

Allowed organization roles:

- `OWNER`
- `MANAGER`
- `CASHIER`

The role is enforced by the organization guard and revalidated inside the financial transaction.

## Request

```json
{
  "clientTransactionId": "70987f2b-2f95-4a42-8853-479cf43c183a",
  "items": [
    {
      "productId": "3380e77a-3287-42f4-9126-bf94c02370bb",
      "quantity": 2
    }
  ],
  "payments": [
    {
      "method": "GCASH",
      "amount": "900.00",
      "referenceNumber": "GCASH-10425"
    }
  ]
}
```

The client submits product identity and quantity only. It does not submit trusted prices, merchant IDs, line totals, discounts, or sale totals.

Duplicate product lines are combined before calculation. A request supports up to 200 submitted item lines, 10 payment records, and a combined quantity of up to 1,000,000 per product.

## Server-authoritative validation

Inside a serializable database transaction, the service reloads and verifies:

- the acting user's current organization role;
- the branch's organization ownership;
- each branch inventory row;
- active product status;
- active merchant status;
- current merchant participation in the branch;
- current product selling price; and
- sufficient online inventory.

Online checkout rejects insufficient inventory. The later offline POS milestone may accept legitimate offline sales that create a reconciliation discrepancy, but that policy is not used by the connected checkout endpoint.

## Money and payments

All calculations use Prisma `Decimal` values. The backend calculates every line and the complete sale total from current stored prices.

The sum of payment amounts must exactly match the calculated sale total. Initial methods are:

- `CASH`
- `GCASH`
- `BANK_TRANSFER`
- `OTHER`

Every non-cash payment requires a reference number. Payment amounts represent the amount applied to the sale; cash tendered and change-due tracking are not included in this part.

Discount fields are persisted as `0.00`. No discount input or business rule has been introduced yet.

## Atomic writes

One transaction performs all of the following or none of them:

1. creates the sale header;
2. creates historical sale-item snapshots;
3. creates confirmed manual payment records;
4. conditionally decrements each inventory quantity; and
5. appends an immutable `SALE` inventory movement linked to the sale.

The conditional inventory update requires the latest quantity to remain sufficient. A concurrent stock change therefore causes the entire checkout to roll back rather than partially completing.

## Idempotency

`clientTransactionId` is a client-generated UUID unique within the organization.

If the same organization, branch, and client transaction ID is submitted again after a completed sale, the existing sale is returned and inventory is not deducted again. Unique or serializable concurrency conflicts also attempt to recover the completed matching sale before returning an error.

Reusing an organization-level client transaction ID for another branch conflicts with the existing uniqueness constraint and does not create a second transaction.

## Response

The response includes:

- server-generated sale ID and sale number;
- organization, branch, and cashier summaries;
- exact monetary strings;
- historical item snapshots;
- merchant attribution;
- payment records; and
- completion timestamp.

## Errors

- `400` — invalid input or missing non-cash reference
- `403` — the acting membership can no longer complete sales
- `404` — branch not found
- `409` — unavailable product, insufficient inventory, payment mismatch, or unresolved concurrency conflict

All tenant identifiers and financial values are derived or revalidated by the backend.
