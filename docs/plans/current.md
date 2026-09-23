# Inventory Movement Reason Details

**Status:** Approved for implementation September 23, 2026.

## Scope

- In the branch Inventory Movement records tab and placement Inventory detail
  movement history, move the Reason column to the final column.
- Replace inline reason text with a compact, text-only `View` action that has a
  gray pill hover treatment and opens an accessible read-only modal containing
  the movement reason.
- Render movement timestamps consistently with the Philippine-local numeric date
  on the first line and the time with seconds on the second line.
- Use matching header/row grids and spacing at each breakpoint. At tablet widths,
  use compact columns and a horizontal-scroll fallback so the final Reason/View
  column remains available instead of being clipped.
- Keep movement data, ordering, pagination, role visibility, actor privacy,
  links, and backend contracts unchanged.
- Preserve responsive table rows and provide keyboard/focus-safe modal dismissal
  and an explicit Close action.
- Replace generic branch Inventory stock and Stock integrity loading placeholders
  with column-aligned table skeletons that preserve each table's responsive row
  structure.
- Refine the Inventory stock table by removing its status column, using semantic
  quantity colors, removing identity hover underlines, and adding an explicit
  View action linking to placement details.
- Add SKU as its own Inventory stock table column, moving it out of the grouped
  product metadata.

## Exclusions

- No API, database, authorization, or movement-history query changes.
- No editing, deleting, or mutation controls for movement reasons.

## Validation

- Update detail and branch movement-record component tests for the View action,
  modal content, close behavior, and final-column layout.
- Add Inventory stock and Stock integrity loading-skeleton coverage.
- Update Inventory stock table coverage for quantity status colors, the explicit
  View action, and the removed status column.
- Add SKU-column coverage to the Inventory stock table tests.
- Run frontend formatting, focused tests, lint, typecheck, and production build.
