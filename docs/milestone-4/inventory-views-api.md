# Inventory Views and Movement History API

## Scope

This part adds read-only views for current branch inventory and its append-only movement history. It does not add new inventory mutation types or frontend pages.

## Endpoints

Both routes require an access token and an `OWNER` or `MANAGER` organization role.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/organizations/:organizationId/inventory` | Browse current inventory |
| `GET` | `/organizations/:organizationId/inventory/movements` | Browse movement history |

## Current inventory

The inventory endpoint supports:

- `branchId`
- `merchantId`
- `productId`
- product `status`
- `search` across product name, SKU, and barcode
- `offset`, defaulting to `0`
- `limit`, defaulting to `50` and capped at `100`

Its response contains `items`, `total`, `offset`, and `limit`. Each item includes the current quantity plus the related product, merchant summary, and branch summary. Decimal prices are returned as two-decimal strings.

Inventory rows are ordered predictably by product name, branch name, and product ID.

## Movement history

The movement endpoint supports:

- `branchId`
- `productId`
- movement `type`
- `cursor`
- `limit`, defaulting to `50` and capped at `100`

Movements are ordered newest first by creation time and ID. The response contains `items` and a nullable `nextCursor`. To retrieve another page, send the returned cursor with the same filters.

Each movement includes product and branch summaries and the ID/email of the user responsible for the operation.

## Pagination decision

Current inventory uses offset pagination because it is a bounded operational snapshot where a total count is useful to the interface. Movement history uses cursor pagination because it is an append-only ledger that can become much larger over time.

Movement cursors are checked against the organization and active filters. A missing, cross-tenant, or filter-incompatible cursor returns `404` rather than exposing record existence.

## Tenant isolation

Every database query includes the authenticated organization ID. Branch, merchant, product, status, search, and movement filters only narrow that tenant-scoped query.

## Explicit exclusions

This part does not implement low-stock thresholds, product categories, CSV exports, sales movements, returns, damaged-stock workflows, or frontend inventory pages.

