# Current Implementation Plan

## Inventory adjustment method dropdown (approved September 21, 2026)

- Replace the simultaneous quantity-change and new-stock-value fields with a
  custom accessible dropdown, defaulting to **New stock value**, that renders
  exactly one input beside the dropdown at a time.
- Preserve the existing either/or validation, numeric filtering, debounced live
  feedback, confirmation, idempotency, and backend stock safeguards.

This focused frontend refinement is being committed with the current inventory
modal refinements.

## Modal action alignment (approved September 21, 2026)

- Place submit and primary action controls at the lower right of every form
  modal, preserving labels, pending states, focus behavior, and dismissal
  safeguards.
- Keep modal-specific secondary/cancel actions and existing workflow behavior
  unchanged.

This focused modal-layout refinement was implemented and committed as
`e644ec0`.

## Adjustment confirmation summary (approved September 21, 2026)

- Make the adjustment confirmation dialog readable as a complete review summary
  containing the product, branch, current stock, selected method, requested
  value or change, net change, estimated result, and reason.
- Preserve server-authoritative validation, confirmation/cancellation behavior,
  idempotency, and branch-scoped stock safeguards.

This focused confirmation-dialog refinement is being implemented now and
remains uncommitted for review.
