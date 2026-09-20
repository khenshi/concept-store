# Current Implementation Plan

## Inventory workflow refinement (approved September 20, 2026)

Improve the existing branch Inventory experience in two reviewable parts without
changing inventory APIs, authorization, tenant isolation, or stock business rules.

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

Part 2 is being implemented now and remains uncommitted for review.

The completed table redesign parts remain archived in
[`inventory-stock-table-refinement-2026-09-19.md`](archive/inventory-stock-table-refinement-2026-09-19.md)
and
[`shared-table-pattern-propagation-2026-09-19.md`](archive/shared-table-pattern-propagation-2026-09-19.md).
