# Superseded current plans — October 19, 2026

Archived when the user requested a new Reports period plan. Existing statuses
are preserved; archiving does not establish completion of outstanding checks.

## Organization member and invitation directory columns

**Status:** Implemented locally October 19, 2026; focused validation complete.

### Goal

Separate member and invitation identity, contact/access details, lifecycle
dates, status and actions so the owner-facing organization directories are
easier to scan.

### Scope and exclusions

- Split the responsive member directory into Member, Contact, Role, Access,
  Joined and Actions columns.
- Split the responsive invitation directory into Recipient, Role, Access,
  Status, Expires and Actions columns.
- Add a confirmed Remove action to every invitation row. Active invitations
  are revoked so their links become invalid; expired, accepted and previously
  revoked invitations are permanently deleted with their access grants.
- Add the tenant-scoped explicit branch-assignment count to the existing member
  list response so staff access summaries are accurate without per-row requests.
- Keep role changes, branch editing, merchant linking, authorization and
  responsive row behavior unchanged.
- Do not add sorting, filtering, other member data, or a database migration.

Stop after focused frontend/backend tests, typecheck, lint, formatting, module
documentation and diff validation are complete.

## Borderless workspace chrome

**Status:** Implemented locally October 14, 2026; focused validation remains.

### Goal

Remove decorative boundaries from the authenticated workspace sidebar and top
bar so the shell reads as one continuous surface.

### Scope and exclusions

- Remove outer and internal shell borders from desktop/mobile sidebar and top-bar
  surfaces.
- Preserve selected navigation borders, content/table dividers, focus rings,
  modal boundaries and all workspace behavior.
- Keep responsive layout, navigation, organization switching and mobile drawer
  focus behavior unchanged.

Stop after focused shell tests, frontend validation and module documentation
updates are complete.

## Branch selector header width alignment

**Status:** Implemented locally October 13, 2026; focused validation remains.

### Goal

Keep branch-selection entry headers aligned with their selected-branch
workspaces by using the same centered wide content track.

### Scope and exclusions

- Use the wide organization page frame for Inventory and Reports entry states.
- Preserve the shared `PageHeader`, selector behavior, route transitions,
  loading/error states and all branch authorization behavior.
- Leave POS and Spaces unchanged because their entry and selected states already
  use the wide frame.

Stop after the focused branch-selection test, frontend validation and module
documentation update are complete.

## System-wide modal backdrop blur

**Status:** Implemented locally October 13, 2026; automated validation and
rendered browser QA remain.

### Goal

Keep the page below every modal visually present but de-emphasized with a shared
Apple-inspired scrim and backdrop blur.

### Scope and exclusions

- Apply a 12px blur and existing scrim to every native `<dialog>` backdrop.
- Apply the same treatment to custom confirmation and account-deletion overlays.
- Preserve modal content, focus restoration, scroll locking, Escape handling,
  pending-dismissal protection, responsive layout and accessibility semantics.
- Do not change modal timing, dismissal rules, or business behavior.

Stop after the shared backdrop styles, affected frontend module documentation,
focused tests, typecheck, lint, formatting and diff validation are complete.

## System-wide card surface treatment

**Status:** Implemented locally October 13, 2026; automated validation and
rendered browser QA remain.

### Goal

Give card-like surfaces a single Apple-inspired treatment: white theme surface,
20px corners and no outer border or shadow.

### Scope and exclusions

- Add the shared borderless `card-surface` treatment and apply it to true cards,
  panels, collection surfaces, dashboards, chooser cards, guest forms and
  public interface previews.
- Set structural `data-surface` collections to the same 20px borderless geometry.
- Preserve internal row dividers, status/input/tab/pill geometry, semantic notice
  borders, popover/dialog elevation, content, responsive behavior and all
  existing backend contracts.
- Keep theme-aware surface tokens so dark themes retain readable contrast.

Stop after the shared card treatment, affected frontend module documentation,
focused tests, typecheck, lint, formatting and diff validation are complete.

## Shared error feedback presentation

**Status:** Implemented locally October 12, 2026; focused automated validation
is complete, while the full-suite baseline and rendered browser QA remain.

### Goal

Make request, session and form-level feedback easier to scan and recover from
without exposing generic internal server errors as user-facing copy.

### Scope and exclusions

- Refresh shared `Notice`, `RequestError` and `StatusNotice` treatments with a
  consistent bordered surface, semantic icon, readable message hierarchy and
  responsive retry action.
- Normalize generic internal/unhandled server messages to the existing safe
  service-unavailable message in the frontend API client.
- Use the shared error treatment for the authenticated session failure state.
- When a branch selector is placed in a `PageHeader`, render its request error
  as a full-width row below the title and action row; keep standalone selector
  errors inline.
- Preserve field-level compact validation, request behavior, role visibility,
  authorization, API contracts and all existing recovery callbacks.
- Do not redesign every feature-owned inline validation or access message in
  this pass.

Stop after the shared feedback primitives, session failure surface, focused
tests and frontend validation are complete.

## Sidebar navigation icon semantics

**Status:** Implemented locally October 12, 2026; automated validation and
rendered browser QA remain.

### Goal

Give each organization workspace sidebar destination a distinct, recognizable
icon that matches its page semantics.

### Scope and exclusions

- Reuse the existing shared icon component and add only the missing chart glyph
  required by Reports.
- Update destination icon mapping for Overview, Branches, Merchants, Products,
  Members, Sales, POS, Inventory, Spaces and Reports.
- Preserve routes, labels, role visibility, active states, collapsed behavior and
  mobile navigation.
- Do not change navigation grouping, permissions, page content or API behavior.

Stop after the semantic icon map and its frontend module documentation are
updated and the focused navigation checks pass.

## Workspace overview navigation and layout

**Status:** Implemented locally October 12, 2026; automated validation and
rendered browser QA remain.

### Goal

Make the organization workspace overview a clear, theme-consistent launchpad for
the same role-allowed destinations available in sidebar navigation.

### Scope and exclusions

- Group overview links into Branch operations, Organization and Personal.
- Include Reports, Inventory, Spaces and POS alongside existing organization and
  Account settings links, using the same role visibility and routes as the sidebar.
- Use flat bordered cards, existing typography, rounded controls and the shared
  icon map; keep the role badge in the page header.
- Preserve navigation behavior, permissions, route contracts and page content.

Stop after the responsive overview layout, role visibility coverage, focused
frontend tests and module documentation are updated.

## System-wide collection states and pagination

**Status:** Implemented locally October 12, 2026; automated validation is complete and rendered browser QA remains.

### Goal

Make table and collection presentation consistent across the workspace by reusing
one centered no-data warning treatment and one pagination navigation treatment.

### Scope

- Add shared frontend `EmptyState` and `PaginationControls` components.
- Apply the centered warning box to empty table/list states that currently use
  plain text or unboxed messages.
- Apply icon-based previous/next pagination with the page indicator between the
  controls to existing numbered and cursor-backed table/list pagination. The
  Inventory stock directory uses numbered controls backed by cached cursors
  while preserving its cursor-based API contract. Every table page indicator
  shows the current page and available page count; cursor-backed inventory
  reads and Reports rankings expose the count from the backend.
- Use a consistent default page size of 15 across the existing table/list
  pagination while preserving query parameters, cursor behavior, loading states,
  errors, filters, authorization, and data semantics unchanged.
- Use the shared collection shell with stacked controls for operational
  directories and inline controls for report tables, while keeping columns,
  filters, actions and data ownership in their feature components.
- Keep cursor-backed load-more interactions only where previous-page navigation
  cannot be reconstructed safely; align their visual treatment where practical.

### Explicit exclusions and stop condition

This pass does not add a new data source, alter table columns, or redesign
non-collection form states. Backend changes are limited to total-page metadata
and the count queries required by existing cursor-backed collection reads; no
database schema change or new pagination model is introduced. Stop after the
shared presentation primitives and metadata are applied to the existing
paginated tables/lists and their relevant empty states, with focused frontend
and backend tests, typecheck, lint, formatting and diff validation complete.

## Reports Transactions tab

**Status:** Approved by the user October 11, 2026; implementation is in progress.
The initial backend/API and Reports tab slice is implemented locally. Full
acceptance, documentation review and rendered QA remain before archiving this
plan.

### Goal

Add a **Transactions** tab to the existing branch Reports workspace as a read-only
cross-reference for completed sales and completed refunds. Keep the existing Sales
History surfaces as the operational workflow for receipt lookup, receipt detail and
refund actions. The new tab is an analysis/audit entry point, not a replacement
sales screen or a second refund workflow.

### Recommended phase-one scope

- Include completed `SALE` and `REFUND` rows for the selected branch and applied
  Philippine calendar-date range. A refund row uses its own completion date; it is
  not placed under the original sale date.
- Represent returned units through the refund row. Keep inventory `RECEIPT`,
  `SALE`, `RETURN` and `ADJUSTMENT` movement history in Inventory, where quantity
  balances and movement reasons already have their correct operational context.
- Add optional `type=SALE|REFUND` and debounced `q` filters. Search matches saved
  receipt codes and refund codes. Reuse the existing strict `from` inclusive and
  `until` exclusive report range, server pagination, branch picker and refresh
  behavior.
- Show newest transactions first with a stable completion-time and ID tie-breaker.
  Use a server-derived total and page count; never merge separately paginated sales
  and refunds in the browser.
- Keep the tab read-only. Sale rows link to the existing sale/receipt detail;
  refund rows link to their original sale detail, where the existing refund history
  and authorized return workflow remain available.

### Proposed role contract

| Role            | Transactions projection                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OWNER / MANAGER | All completed sales and refunds in the permitted branch, with the existing staff-safe receipt, payment, refund and actor fields.                              |
| MERCHANT        | Own-item sales and refunds only, using reduced merchant projections; no whole-sale totals, other merchants, cashier/payment fields or private refund details. |
| CASHIER         | Denied Reports access as today; existing POS Sales History remains unchanged.                                                                                 |

The endpoint must reuse Reports membership, role, merchant-link and branch checks,
then apply the existing sale/refund historical privacy rules. Foreign or revoked
scope must retain current not-found/forbidden behavior.

### Proposed table and interaction

Use the existing Reports tab treatment and operational table conventions:

- Tabs: `Overview`, `Transactions`, `Daily Data`, `Rankings`.
- Filters: report period, transaction type and receipt/refund-code search.
- Columns: Date, Type, Reference, Branch/merchant context where permitted, Amount
  or own subtotal, and Action. Row actions remain labeled View.
- Loading skeleton, empty state, filtered-empty state, request error/retry,
  pagination and stale-read protection must match the existing Reports workspace.
- Amounts and dates remain saved transaction snapshots. No edit, delete, refund,
  restock, export or print action is offered from this tab.

### Minimal API extension

Add a read-only route in the existing Reports module:

```text
GET /organizations/:organizationId/branches/:branchId/reports/transactions
```

The whitelisted query accepts the shared `from`, `until`, `page` and `limit`
fields plus optional `type` and `q`. The response is a scope-discriminated page
with `items`, `page`, `limit`, `total`, `totalPages` and a discriminated `SALE` or
`REFUND` row. Each row carries only the fields allowed by its role projection and
the source-detail link identifiers required by the frontend.

The service should read authorization, count and page rows from one repeatable-read
snapshot. A `UNION ALL`-style source query or equivalent separate source reads must
avoid sale/refund join inflation; refund totals and sale totals remain independent.
Reuse existing completion-time indexes first. Add no migration or index unless a
measured query plan proves it necessary.

### Implementation sequence after approval

1. Confirm the phase-one boundary and role-visible row fields; explicitly decide
   whether inventory movements remain excluded.
2. Add backend DTOs, discriminated response types, Reports service/controller
   query, OpenAPI documentation, authorization tests, pagination/filter tests,
   snapshot consistency tests and tenant/privacy regression coverage.
3. Add the frontend API/model contract and a Reports-owned Transactions panel;
   extend tab state without changing existing Overview, Daily Data or Rankings
   behavior. Add table skeleton, filters, empty/error states and source links.
4. Add frontend tests for tab switching, query serialization, date/type/search
   filters, pagination, stale responses, role projections and source navigation.
5. Run backend validation, frontend lint/typecheck/tests/build, formatting and
   focused disposable-PostgreSQL proof. Browser-check desktop and narrow layouts,
   keyboard tabs, filters, loading/error/empty states and merchant privacy.
6. Update `docs/modules/reports.md`, `docs/modules/frontend-experience.md`,
   `docs/modules/sales.md` and `docs/modules/refunds.md` with the implemented
   contract, then archive this plan only after acceptance is complete.

### Explicit exclusions and stop condition

This plan does not replace Sales History, create a general audit log, add a new
transaction entity, change checkout/refund/inventory behavior, expose provider
settlements, add exports, add analytics, or combine space/occupancy events. Stop
after the read-only sale/refund tab meets the role, filter, pagination, snapshot,
source-link and responsive acceptance checks. Inventory movement unification is a
separate scope decision.

## Account Settings responsive refinement

**Status:** Implemented locally October 12, 2026; focused validation and rendered
desktop/mobile review are complete. The full frontend suite retains seven
unrelated failures outside this slice.

### Goal

Make the existing Account Settings route easier to scan and use across desktop,
tablet and mobile while preserving Kapwesto's operational design system and all
existing account API behavior.

### Scope

- Use a centered, compact page layout with in-page Profile, Appearance and
  Security navigation. Give each top-level section one rounded bordered surface
  and keep the selected navigation item live as the page scrolls.
- Keep the personal information form responsive, visually distinguish the
  read-only email field, and keep profile feedback and Save changes attached to
  the form.
- Make the existing theme choices compact, grouped by Light/Dark, and visibly
  selected without changing theme values or persistence.
- Add password visibility controls and clearer validation, pending, success and
  error feedback while preserving the existing password schema and sign-out
  behavior.
- Move account deletion into a separate Danger zone section and collect the
  existing password contract inside an accessible confirmation modal.
- Preserve routes, API requests, authentication, authorization, validation,
  tenant behavior and all existing account functionality.

### Exclusions and stop condition

This slice does not add account capabilities, change backend contracts, change
theme palettes, alter the global workspace shell, or redesign unrelated pages.
Stop after the Account Settings components, focused tests, frontend validation,
module documentation and bounded rendered desktop/mobile review are complete.

## Branches table status and action alignment

**Status:** Implemented locally October 12, 2026; focused validation is complete.

### Goal

Improve scanability and visual grouping in the existing staff Branches directory
without changing branch data, actions, authorization, or responsive behavior.

### Scope and stop condition

- Render the existing Active/Inactive status as a compact pill.
- Align the existing View action beneath the Actions column label.
- Use the Settings page's warm gray canvas and flat bordered white card treatment
  for the Branches page frame, summary and directory surfaces.
- Preserve all routes, requests, permissions, table columns, and narrow-screen
  stacking behavior.

Stop after the focused Branches workflow tests, frontend validation and module
documentation are updated.

## Inventory movement date range picker

**Status:** Implemented locally October 18, 2026; focused validation is complete.

### Goal

Replace the Movement records toolbar's paired native date inputs with one
accessible calendar that supports filtering one selected Philippine date or an
inclusive two-date range.

### Scope and exclusions

- Let the user choose one day or a second day to form a date range in one custom
  calendar surface.
- Preserve the existing `from`/`until` UTC API contract, Apply/Clear behavior,
  branch scope, loading states, pagination, authorization and movement data.
- Keep the calendar dependency-free and responsive; do not add recurring dates,
  time selection, multi-range selection, or backend changes.

Stop after focused Inventory movement tests, frontend validation, module
documentation and layout/diff checks are complete.

## Shared Philippine date range picker

**Status:** Implemented locally October 18, 2026; focused validation is complete.

### Goal

Reuse the Inventory Movement Records one-calendar date selection pattern on the
Reports period control through a shared UI component.

### Scope and exclusions

- Extract the dependency-free calendar into `frontend/src/shared/components/ui`
  with one-day and inclusive two-date selection.
- Migrate Inventory movement records and Reports to the shared picker without
  changing their existing UTC request contracts, authorization, loading states,
  pagination, or report period limits.
- Preserve the Reports Apply-period workflow and the Inventory Apply/Clear
  workflow; do not add backend changes, dependencies, time selection, or other
  calendar modes.

Stop after focused Inventory/Reports tests, frontend validation, module
documentation and layout/diff checks are complete.
