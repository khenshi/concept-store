# Current Implementation Plan

**Status:** Approved September 19, 2026. Deliver in
reviewable, uncommitted parts; commit each part only after approval.

**Current part:** Part 2 is implemented and intentionally uncommitted for review.

Part 1 (core directories) was reviewed and committed as `a8dddea`.

## Dense record-list and table refinement

### Intent

Apply the supplied table reference to dense record collections across the
application while keeping the organization chooser as its approved card grid.
The pattern is a calm, lightly contained data surface: a compact column/header
row, aligned records, restrained tags for statuses, quiet metadata, a clear
trailing action affordance, and a small result/pagination footer where the
workflow already supports pagination. Use the monochrome graphite foundation
already committed in `65286e7`; semantic success, warning and danger colors
remain only where they communicate a meaningful state.

This is a presentation-only plan. No API, database, authorization, tenant or
branch behavior changes are included.

### Approved behavior to preserve

- Preserve existing requests, filters, search/debounce behavior, pagination,
  branch selectors, role-specific visibility, links, actions, dialogs, forms,
  status feedback, pending-write protection and print surfaces.
- Preserve accessible headings, labels, table/list semantics, keyboard focus,
  non-color status meaning, loading/empty/error states and 200% zoom behavior.
- Use true table markup for genuinely comparable columns. Use a semantic list
  with a table-like grid for directory rows that contain links or responsive
  stacks. Keep a horizontal scroller for wide tables and a readable stacked
  mobile arrangement where the current workflow requires it.
- Use modest rounding on the single data surface, tags and controls. Do not
  add a card around each record or add decorative rules between every row.

### Scope

Dense collections in scope:

- Branches, organization members, Merchants and Products directories.
- Branch inventory placements, placement/history detail lists and stock
  reconciliation rows.
- Branch Sales, merchant Sales and sale/refund history lists.
- Reports' exact daily tables, top-product tables and payment/refund breakdown
  collections.

Explicitly excluded:

- The organization chooser `/app`, which remains the approved card grid.
- POS cart, product search, checkout/payment confirmation and receipt surfaces;
  these are task-oriented operational work areas, not record tables.
- Dialog-only lists such as branch grants, product combobox options and refund
  confirmation details; forms, navigation drawers and the public landing page.
- New columns, fabricated counts/activity dates, bulk actions, sorting,
  server/API changes or a new component library.

### Reviewable parts

1. **Shared table language and core directories.** Define the reusable visual
   conventions in `DESIGN.md` and shared styles, then apply them to Branches,
   Members, Merchants and Products. Preserve directory rows and actions. Stop
   uncommitted for review.
2. **Inventory and Sales collections.** Apply the same header/row/tag/footer
   treatment to Inventory placements, stock history/reconciliation and Sales
   lists/details, including merchant and branch-specific visibility. Stop
   uncommitted.
3. **Reports collections.** Apply the table pattern to exact daily data,
   top-selling products and payment/refund breakdowns without changing chart
   plots, totals or report privacy. Stop uncommitted.
4. **Final verification.** Run formatting, lint, typecheck, all frontend tests,
   production build and diff checks. Verify responsive table scrolling/stacking,
   keyboard/focus, statuses, pagination and print-sensitive views in a browser,
   or obtain a fresh explicit waiver. Update module documentation and archive
   this plan only after final approval.

### Acceptance checks

- Dense record pages have one calm data surface with a clear header, aligned
  values, restrained tags and an obvious row action/target.
- The organization chooser remains a responsive rounded card grid.
- No page becomes blue; ordinary actions and navigation remain monochrome while
  semantic status colors retain their meaning.
- Existing role/branch access and data visibility remain unchanged.
- Mobile layouts remain readable without forcing illegible compressed columns.
