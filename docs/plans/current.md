# Current Implementation Plan

**Status:** Approved September 19, 2026. Inventory Part 1 was reviewed and
committed. Implement the remaining comparable tables as one reviewable,
uncommitted presentation part; commit only after user review.

## Shared table pattern propagation

### Intent

Propagate the approved Inventory Stock reference treatment to the remaining
comparable tables and lists: spacious labeled headers, grouped identity,
separated comparison values, restrained separators, quiet trailing actions and
soft rounded filter controls. Keep the existing warm neutral Kapwesto system and
Poppins typography.

### Scope

- Apply the approved composition to Branches, Members, Merchants, Products,
  Inventory detail/movement/reconciliation, Sales and Reports collections.
- Keep each page's existing search, date, branch and status controls as
  accessible controls, restyled consistently with Inventory where appropriate.
- Preserve every existing request, action, role/branch visibility, merchant
  privacy rule, pagination/load-more behavior and loading/empty/error state.
- Preserve responsive stacking, keyboard/focus behavior and true-table semantics
  where they already exist.

Explicitly excluded: API/database/authorization changes, new columns or
fabricated data, organization chooser card grid, POS cart/checkout surfaces,
forms, dialogs and public landing-page structure.

### Acceptance checks

- All in-scope tables/lists have visible, aligned labels above their records
  without a heavy card header or strong divider treatment.
- Related identity metadata stays grouped while comparable values and actions
  read as distinct columns on wide screens and readable stacks on narrow screens.
- Existing filters retain their accessible behavior while matching the soft
  rounded reference style where they are present.
- Frontend tests, typecheck, lint, production build and diff checks pass.
- No unrelated working-tree files are staged or changed.
