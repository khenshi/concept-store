# Inventory workflow refinement (approved September 20, 2026)

Improve the existing branch Inventory experience in reviewable parts while
preserving authorization, tenant isolation, and the existing stock ledger rules.

### Part 1 — Inventory shell and stock list

- Keep Stock integrity in the Inventory page shell as a separate staff-only tab.
- Rename row actions to **Stock in** and **Adjust**, keeping their existing
  receipt/adjustment commands and safeguards.
- Keep the two row actions on one line at tablet widths.
- Add a search icon to the inventory search field.
- Request inventory pages with a five-item page size; retain cursor-based load
  more behavior.

This part was reviewed and committed as `3e34a8f`.

### Part 2 — Add placement modal

- Debounce eligible-product search requests.
- Use the product search bar as the picker: focus/click opens the first five
  eligible products, while typing debounces server-filtered results.
- Keep selling price and low-stock threshold on one row at suitable widths.

Part 2 was reviewed and committed as `ac3e67a`.

### Part 3 — Compact validation feedback

- Place shared-field and product-picker validation errors beside their labels as
  compact red feedback.
- Preserve the full accessible error description and existing live, blur and
  submit validation behavior.

Part 3 was reviewed and committed as `8f53e73`.

### Part 4 — Required opening stock and numeric placement fields

- Require an opening-stock quantity when adding a product placement, validate it
  as a nonnegative whole number, and record positive opening stock as an
  attributed receipt in the same transaction as the branch placement.
- Sanitize the placement selling-price, low-stock-threshold, and opening-stock
  inputs at the frontend boundary so letters and other unsupported characters
  cannot be entered; retain debounced live validation and authoritative backend
  validation.
- Keep existing branch, organization, role, duplicate-placement and movement
  safeguards. This part does not change product creation's separate opening-stock
  workflow or add a new stock command.

Part 4 was reviewed and committed as `be23509`.

### Part 5 — Reason-free stock receipts

- Remove the user-entered reason from regular **Stock in / Receive stock** forms
  and requests.
- Keep adjustment reasons required, and assign the stable system reason
  `Stock received` to receipt movements for immutable history and replay safety.
- Preserve quantity validation, request-ID idempotency, active product checks,
  branch authorization, and tenant isolation.

Part 5 was reviewed and committed as `be23509`.

### Part 6 — Absolute stock adjustment input

- Add a **New stock value** input beside the signed **Quantity change** input;
  users may submit exactly one of the two, while adjustment reasons remain
  required.
- Accept only nonnegative whole numbers for the absolute value and filter
  letters/unsupported characters from stock number fields as they are entered.
- Derive absolute-value deltas from the authoritative branch balance, reject
  stale target writes, and preserve existing authorization, bounds,
  idempotency, and immutable movement history.

Part 6 was reviewed and committed with the inventory workflow refinement.

The completed table redesign parts remain archived in
[`inventory-stock-table-refinement-2026-09-19.md`](inventory-stock-table-refinement-2026-09-19.md)
and
[`shared-table-pattern-propagation-2026-09-19.md`](shared-table-pattern-propagation-2026-09-19.md).
