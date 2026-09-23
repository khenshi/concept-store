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

This focused confirmation-dialog refinement was implemented and committed as
`74dd522`.

## Inventory placement detail redesign (approved September 21, 2026)

- Rework the placement detail screen to follow the approved reference hierarchy:
  back/context header, branch and product actions, an unlabeled placement summary
  introduced by one horizontal divider, side-by-side stock workflows, and a
  structured movement-history list.
- Keep branch/tenant authorization, live validation, server-authoritative stock
  commands, price and threshold editing, history pagination, and responsive
  behavior intact. Preserve full-width dividers while adding small horizontal
  insets to list content.
- Keep branch-price editing out of the placement summary, expose product-profile
  navigation as the fourth summary metric, give the receive/threshold column less width than
  correction, align Receive stock and Low-stock threshold as parallel controls
  with each action beside its input, and shorten summary separators so they have
  vertical breathing room.
- Keep the detail back control compact, tighten the header-to-summary and
  summary spacing, start-align each summary item within equal grid cells, add a
  divider before movement history, and render movement history before the
  receive, threshold, and correction controls.

This focused frontend redesign is being implemented now and remains uncommitted
for review.

## Inventory history actor names (approved September 22, 2026)

- Return the authenticated movement actor's display name in owner/manager
  inventory history and omit actor information from merchant history.
- Keep tenant and branch scoping, authenticated actor attribution, mutation
  response contracts, and merchant privacy safeguards unchanged.

This focused history contract change is being implemented now and remains
uncommitted for review.

## Inventory detail action switcher (approved September 22, 2026)

- Place Receive, Adjust, Threshold, and Edit price actions beneath movement
  history on the inventory detail screen as an underlined tab strip.
- Keep Receive stock open by default and show only the selected action's
  existing validated form at a time. Do not add a separate close control;
  switching actions still protects unsaved input with confirmation. Preserve
  role checks, branch scoping, pending states, and server-authoritative writes.

This focused inventory-detail interaction change is being implemented now and
remains uncommitted for review.

## Movement history pagination (approved September 22, 2026)

- Show five movement-history items per page on the inventory detail screen.
- Reserve the visual height of five desktop movement rows so shorter final pages
  do not collapse the history panel; allow taller wrapped rows on smaller screens.
- Replace the append-only older-history control with Previous and Next page
  navigation backed by the existing scoped cursor contract.
- Preserve current-stock state, retry behavior, access-loss handling, actor
  privacy, and reset pagination after a placement refresh.
- Do not change the backend or database: the existing movement endpoint already
  accepts a bounded `limit` and cursor.

This focused frontend pagination change is being implemented now and remains
uncommitted for review.

## Unified action and dropdown rounding (approved September 23, 2026)

- Use the inventory list's pill-shaped radius for shared action buttons and
  dropdown triggers across public and authenticated pages.
- Include raw application buttons and shell selectors in the same visual system
  without changing button variants, focus behavior, menu behavior, or semantics.
- Keep structural tabs, status tags, and dropdown menu options compact or
  role-specific where their geometry communicates state or navigation.

This focused frontend visual refinement is being implemented now and remains
uncommitted for review.

## Inventory detail loading skeleton (approved September 23, 2026)

- Show a layout-preserving skeleton for the inventory detail title,
  description, branch context, and four placement-summary metrics while the
  detail reads are pending.
- Keep branch switching available, preserve the existing movement-history
  loading state, and remove the skeleton without changing loaded content or
  authorization behavior.

This focused frontend loading-state refinement is being implemented now and
remains uncommitted for review.
