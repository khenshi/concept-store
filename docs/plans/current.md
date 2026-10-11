# Current plan

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
