# Milestone 5 Part 2: POS Product Lookup API

## Scope

This part adds the read-only, branch-scoped product catalog required by the online POS. It does not add a cart, checkout writes, sales history, receipt generation, or frontend POS workspace.

The existing product lookup remains a management endpoint for owners and managers. The POS catalog is separate because it must:

- allow cashiers;
- apply a required branch context;
- expose current branch quantity; and
- exclude products or merchants that are not currently sellable at that branch.

## Authorization

The endpoints require an authenticated organization membership with one of these roles:

- `OWNER`
- `MANAGER`
- `CASHIER`

`MERCHANT` accounts cannot access the POS catalog. Tenant authorization is enforced by the existing organization access guard. The branch is also queried with both `branchId` and `organizationId` before any catalog results are returned.

Dedicated staff-to-branch assignments do not exist in the current milestone. Cashier access is therefore organization-wide for now; this part does not introduce a new branch-permission model.

## Endpoints

### List branch POS products

```http
GET /organizations/:organizationId/branches/:branchId/pos/products
```

Optional query parameters:

- `search` — partial case-insensitive product name, SKU, or barcode search
- `merchantId` — exact merchant filter
- `offset` — default `0`
- `limit` — default `30`, maximum `100`

### Exact code lookup

```http
GET /organizations/:organizationId/branches/:branchId/pos/products/lookup?code=AMH-01
```

SKU matching is case-insensitive. Barcode matching is exact.

## Sellable catalog rules

A catalog row is returned only when:

- its inventory row belongs to the selected organization and branch;
- the product is `ACTIVE`;
- the merchant is `ACTIVE`; and
- the merchant currently participates in the branch.

The API returns zero and negative quantities rather than concealing those products. It sets `available` to `quantity > 0`. This keeps operational discrepancies visible while allowing the later cart and checkout parts to enforce the final online-sale inventory policy.

Products without an inventory row at the branch are not returned.

## Response shape

Each item contains only POS-relevant data:

```json
{
  "id": "product-uuid",
  "branchId": "branch-uuid",
  "merchantId": "merchant-uuid",
  "name": "Handwoven pouch",
  "sku": "AMH-01",
  "barcode": "4801234567890",
  "sellingPrice": "450.00",
  "quantity": 4,
  "available": true,
  "merchant": {
    "id": "merchant-uuid",
    "name": "Amihan Goods",
    "code": "AMH"
  }
}
```

Prices remain two-decimal strings so the frontend does not receive floating-point money values.

## Errors

- A missing or cross-organization branch returns `404`.
- An exact code that is missing or not sellable in the selected branch returns `404`.
- Invalid UUIDs, codes, pagination values, and filters return `400`.
- Disallowed organization roles return `403`.

## Checkout boundary

Catalog results are informational and may become stale immediately after being read. The upcoming checkout service must reload products, prices, merchant participation, and inventory inside its server-authoritative transaction. It must never trust quantity, merchant, or price values submitted from the POS frontend.
