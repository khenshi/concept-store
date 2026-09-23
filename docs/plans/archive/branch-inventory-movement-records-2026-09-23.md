# Branch Inventory Movement Records

**Status:** Implemented September 23, 2026.

## Summary

Add a second Inventory tab named **Movement records** within the existing branch
Inventory shell.

- Owners/managers: Inventory stock → Movement records → Stock integrity.
- Merchants: Inventory stock → Movement records.
- Records are limited to the currently selected branch.
- Owners/managers see all authorized branch movements and actor names.
- Merchants see only movements for their products, without actor information.
- Cashier access remains unchanged and excluded.

## Backend and data contract

- Add `GET /organizations/:organizationId/branches/:branchId/inventory/movements`.
- Accept `q` (product name, SKU, barcode or reason), `type` (Receipt,
  Adjustment, Sale or Return), staff-only `merchantId`, paired `from`/`until`
  date bounds, `limit` and an opaque `cursor`.
- The frontend sends `limit=10`. Dates represent inclusive Philippine calendar
  dates in the UI; the through date is sent as an exclusive UTC boundary.
- Return `{ items, nextCursor }`, newest first by `createdAt` then movement ID.
- Rows include movement/placement identity, product and merchant identity, type,
  reason, signed change, resulting balance, timestamp, and staff actor name.
- Reuse organization, branch and product visibility scopes. Merchant queries are
  restricted to their own products and omit actors.
- Add a PostgreSQL index for organization, branch, creation time and movement ID.
- Do not expose sale/refund links, request IDs, or mutation operations.

## Frontend experience

- Add an on-demand Movement records panel inside the Inventory page; selecting it
  fetches records without navigation.
- Use the established minimalist data-list layout with product/merchant,
  date/time, movement type, reason, change, balance and staff actor columns.
- Link product identity to that branch placement's Inventory detail page.
- Provide a search field with icon and 300 ms debounce, movement-type dropdown,
  staff-only merchant dropdown, paired From/Through date fields with Apply and
  Clear actions, and Previous/Next cursor pagination with ten records per page.
- Blank dates mean all history. If either date is entered, require both;
  validate From ≤ Through and show Philippine-time labels.
- Reset pagination when search or filters change. Ignore stale responses and
  preserve the visible page if navigation fails.
- Include loading skeletons, empty filtered/unfiltered states, retryable errors,
  responsive rows, keyboard-accessible tabs/filters, and branch-change/access-
  loss resets.

## Test plan

- Backend service/controller tests cover tenant and branch isolation, manager
  assignments, merchant product scoping, actor privacy, all search fields,
  filters, date boundaries, filter-bound cursors, ordering, and invalid/foreign
  cursors.
- Integration coverage covers owner, assigned manager, merchant, cashier denial,
  cross-tenant IDs and the ten-record page boundary.
- Frontend API/schema tests cover query serialization and role-specific
  responses. Component tests cover tab visibility/order, lazy loading, 300 ms
  debounce, filter resets, date validation, pagination/retry, hidden merchant
  fields, loading/empty/error states, stale responses and placement links.
- Run Prisma validation/formatting, backend lint/typecheck/tests, frontend
  lint/typecheck/full tests and production builds.

## Assumptions and exclusions

- Movement records are read-only and branch-scoped. Organization-wide history,
  exports, actor filtering, movement editing and deletion are excluded.
- The first page shows all historical dates unless a range is applied.
- Existing product-specific history on the Inventory detail page remains
  unchanged.
