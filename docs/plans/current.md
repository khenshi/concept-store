# Current plan

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
  controls to existing numbered and cursor-backed table/list pagination.
- Keep current page sizes, query parameters, cursor behavior, loading states,
  errors, filters, authorization, and data semantics unchanged.
- Keep cursor-backed load-more interactions as load-more interactions when there
  is no previous-page cursor or total-page contract; only align their visual
  treatment where practical.

### Explicit exclusions and stop condition

This pass does not add backend pagination, change API response contracts, add a
new data source, alter table columns, or redesign non-collection form states.
Stop after the shared presentation primitives are applied to the existing
paginated tables/lists and their relevant empty states, with focused frontend
tests, typecheck, lint, formatting and diff validation complete.

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
  or own subtotal, and View.
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
