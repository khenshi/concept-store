# API Route and Workflow Alignment Plan

**Status:** Implemented and archived

**Scope:** Existing Milestones 1–7 only

**Audit baseline:** September 2026

**Completed:** September 7, 2026

**Current behavior:** See the workflow references linked from
[`docs/README.md`](../../README.md).

Parts 1–6 were implemented. The notes below preserve the decisions and
verification scope that led to the current contracts.

## Goal

Align the current backend routes with the frontend workflows, complete the
missing refund experience, correct finance/reporting gaps, and remove verified
repository-internal dead API surface. Keep the work inside the existing modular
monolith and preserve tenant isolation, immutable financial history, decimal
arithmetic, and current authorization boundaries.

This is a correction and cleanup of implemented milestones. It does not add a
new reporting platform, accounting integration, payment gateway, or offline POS
behavior.

## Confirmed Product Decisions

- Refunds will be fully usable from Sale Details by owners and managers.
- There are currently no external API clients. Routes with no remaining product
  or internal consumer may be removed after their usages and tests are updated.
- Organization membership is invitation-only. Directly adding an already
  registered user is not a supported workflow.
- Rent reporting must distinguish **accrued**, **collected**, and
  **outstanding** rent.
- A direct rent payment must clear the selected rent receivable in full. Partial
  rent payments are not allowed.
- Rent may be deducted from a merchant payout only when the payout can clear the
  merchant's entire available accumulated rent balance. Partial rent offsets and
  choosing an arbitrary deduction amount are not allowed.
- Live-payable summary metrics cover all matching merchants, not only the visible
  page.
- Finance lists use a consistent 20-row page size.

## Audit Findings to Resolve

### Missing or incomplete workflows

1. The backend refund route has no frontend API client or Sale Details action.
2. Refund creation records financial refund rows but does not currently restore
   inventory or create `RETURN` inventory movements, although the current POS
   workflow documentation promises that behavior.
3. Merchant Activity sales aggregation does not explicitly exclude voided sales.
4. Live-payable metric cards are calculated from the current 20-row page instead
   of all matching merchants.
5. Rent receivables silently show only the backend's first 30 records.
6. Merchant Activity silently caps results at 100 merchants.
7. Dashboard rent revenue is derived from settlement rent deductions and does
   not distinguish directly collected rent from accrued or outstanding rent.

### Verified unused frontend API functions

- `addOrganizationMember`
- `getMerchantAgreement`
- `getSalesReport`
- `getInventoryReport`
- `lookupProduct`
- `getProduct`

### Verified repository-internal unused HTTP routes

| Route                                                                   | Planned disposition                                                                |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `POST /organizations/:organizationId/members`                           | Remove; invitations are authoritative.                                             |
| `GET /organizations/:organizationId/reports/sales`                      | Remove; POS Sales History owns this workflow.                                      |
| `GET /organizations/:organizationId/reports/inventory`                  | Remove; Inventory owns this workflow.                                              |
| `GET /organizations/:organizationId/merchant-agreements/:agreementId`   | Remove; current agreement list/modal data is sufficient.                           |
| `GET /organizations/:organizationId/products/lookup`                    | Remove; branch-aware POS lookup remains.                                           |
| `GET /organizations/:organizationId/products/:productId`                | Remove; there is no product detail screen.                                         |
| `GET /organizations/:organizationId/branches/:branchId`                 | Remove; Branch Overview is the detail contract.                                    |
| `GET /organizations/:organizationId/spaces/:spaceId`                    | Remove; current space management uses list data.                                   |
| `GET /organizations/:organizationId/merchant-receivables/:receivableId` | Remove the controller route only; retain the service read used after mutations.    |
| `GET /organizations/:organizationId/settlements/summary`                | Remove; it summarizes historical settlements and is not the required live summary. |

Keep the root health route, authentication/session routes, dashboard report
routes, Merchant Activity report route, all active CRUD/action routes, POS
branch-aware lookup, and settlement lifecycle routes.

Before deleting each route, run a final repository search covering production
code, tests, documentation, and generated OpenAPI expectations. Since there are
no external clients, no compatibility deprecation period is required.

## Part 1 — Correct Financial and Reporting Rules

### Exclude voided sales consistently

- Add `SaleStatus.COMPLETED` to the Merchant Activity sales aggregation.
- Check other gross/net sales queries for the same invariant and use one
  consistently named completed-sale predicate where it meaningfully reduces
  duplication without introducing a generic query abstraction.
- Keep refunds based on completed refund records. A voided sale cannot later be
  refunded.
- Add regression tests proving a voided sale is absent from owner overview,
  Merchant Activity, live payables, and settlement source calculations.

### Rent accounting definitions

Use the rent ledger as the authoritative source:

- **Accrued rent:** original fixed-rent receivable charges created for the
  selected reporting period.
- **Collected rent:** `PAYMENT` plus applied `SETTLEMENT_DEDUCTION` receivable
  transactions whose occurrence/application date is in the selected period.
- **Outstanding rent:** current sum of remaining rent receivable balances as of
  now. It is a balance, not a period transaction total.
- **Rent adjustments:** disclose separately when needed; do not mislabel an
  adjustment as collected cash.

Update owner dashboard and Merchant Activity labels and response types so
commission revenue, accrued rent, collected rent, outstanding rent, and payout
amounts are not conflated. Period filters apply to accrued and collected
activity; outstanding remains the current tenant-scoped balance and must be
clearly labelled as such.

All aggregates remain server-authoritative and use Prisma decimals. Do not sum
money with frontend floating-point arithmetic for authoritative metrics.

## Part 2 — Complete the Refund Workflow

### Backend transaction

Keep the existing owner/manager-only route:

```text
POST /organizations/:organizationId/branches/:branchId/pos/sales/:saleId/refunds
```

Within one serializable transaction:

1. Revalidate the actor's organization role.
2. Load the tenant- and branch-scoped sale and require `COMPLETED` status.
3. Validate unique selected sale items and positive quantities.
4. Recalculate already-refunded quantities and reject over-refunds under
   concurrency.
5. Derive refund amounts from immutable sale-item totals using decimal rounding.
6. Create the refund and refund-item records.
7. Increment the exact branch inventory records for returned quantities.
8. Create one `RETURN` inventory movement per refunded item, linked to the sale
   and refund reference with the authenticated actor.
9. Return the updated sale detail, including aggregate refunded quantities and
   refund history, so the frontend does not need a fragile second reconstruction.

Do not allow editing or deleting completed refunds. Do not change the original
sale, item, payment, or merchant snapshots. A partially refunded sale remains
`COMPLETED`; its refundable quantities decrease.

### Frontend experience

- Add a typed `refundSale` API function and request/response types.
- On Sale Details, show **Record refund** only to owners/managers when at least
  one item has refundable quantity.
- Open an accessible modal listing sold, previously refunded, and remaining
  quantities per item.
- Default quantities to zero; require at least one positive quantity and a
  documented reason.
- Show the calculated refund total before confirmation, without treating the
  frontend value as authoritative.
- Require confirmation explaining that inventory will be returned and merchant
  balances will change.
- Disable duplicate submission, present validation/conflict errors, refresh the
  sale after success, and preserve keyboard/focus behavior.
- Display refund history and remaining refundable quantity on Sale Details and
  mark fully refunded lines clearly.

## Part 3 — Enforce Full Rent Settlement

### Direct rent payment

- Replace arbitrary payment amounts with a server-derived full payment of the
  selected receivable's available remaining balance.
- Reject payment if any portion of that receivable is reserved by an unpaid
  settlement, because the full available balance cannot be cleared safely.
- Keep method, required non-cash reference, paid-at timestamp, optional note,
  actor, and audit transaction.
- Remove the amount input from the frontend payment form. Display the exact
  server-provided amount being paid and require confirmation.
- Retain `PARTIALLY_PAID` in the database enum for historical records and
  documented balance adjustments, but do not create new partial payment
  transactions.

### Settlement rent deduction

- Replace client-supplied `rentDeductionAmount` with an explicit boolean choice
  such as `deductOutstandingRent`.
- The backend calculates the complete available accumulated rent balance.
- Allow the choice only when merchant payable is greater than or equal to that
  entire balance and the balance is greater than zero.
- If allowed, allocate every included receivable's complete available balance
  oldest-first. Never split a rent receivable and never leave a partial balance
  because a payout was insufficient.
- If the payout is insufficient, keep the rent separate, explain why in the
  preview response, and disable the deduction choice in the UI.
- Revalidate balances and payout inside settlement closure so a stale preview
  cannot reserve an invalid deduction.
- Continue applying reserved allocations only when payout is recorded. Draft,
  reviewed, or approved-but-unpaid settlements must not report reserved rent as
  collected.

Existing historical partial transactions and allocations remain immutable. No
financial history will be rewritten.

## Part 4 — Authoritative Metrics and Pagination

### Live payables

- Extend the live-payables response with a `summary` object covering every
  merchant matching the active merchant/branch filters:
  `grossSales`, `refunds`, `netSales`, `commission`, `adjustments`, `amountDue`,
  and `merchantCount`.
- Keep `items`, `total`, `offset`, and `limit` for the visible 20-row page.
- Produce list rows and summary values through the same backend calculation
  rules. Do not create a second calculation formula in the frontend.
- Batch source queries by merchant where practical so summary generation does not
  call the full single-merchant detail calculation once per merchant. Preserve
  the single-merchant detail calculation for closure review.
- Remove `payableMetrics()` and all authoritative money summing from the
  frontend.
- Expose the already-supported merchant and branch filters on the live overview,
  reset offset on change, and ignore stale responses.

### Rent receivables

- Standardize the DTO default and frontend request to 20 rows.
- Track `total`, `offset`, and `limit`; add Previous/Next controls.
- Add the supported merchant filter alongside status.
- Reset offset after merchant/status changes and after a mutation that changes
  whether a row matches.
- Use loading skeletons without removing the filter controls.

### Merchant Activity and settlement history

- Use 20 rows for Merchant Activity and add explicit Previous/Next controls based
  on the returned total.
- Reset the offset when period, branch, or merchant changes.
- Preserve automatic filtering and stale-response protection.
- Keep settlement history at its existing 20-row frontend page size and align
  backend defaults/types where this does not affect explicit requests.

## Part 5 — Remove Dead API Surface

For every route marked for removal:

1. Remove the controller method and route-specific Swagger decorators.
2. Remove the frontend API function and its unit test.
3. Remove a DTO, response type, service method, or query only when it has no
   remaining internal caller.
4. Preserve shared service reads used after mutations, especially merchant
   receivable `findOne` behavior.
5. Remove obsolete report record types and report service tests for deleted
   sales/inventory report endpoints.
6. Update OpenAPI E2E assertions to describe only the remaining contracts.
7. Run `rg` over the deleted symbol and route fragment to verify no stale link,
   documentation, or test remains.

This cleanup requires no database migration. Do not delete models or historical
records merely because a read route is removed.

## Part 6 — Contract and Test Alignment

Update the currently stale backend E2E expectations:

- Product creation now passes the authenticated actor and optional
  `initialStock`.
- Live-payables listing passes a normalized query DTO.
- Merchant finance entries no longer contain the obsolete entry `type`.
- OpenAPI title is `Kapwesto API`.

Add or extend tests for:

- refund authorization, tenant/branch isolation, completed-sale requirement,
  duplicate item handling, partial quantities, over-refund conflicts, inventory
  restoration, `RETURN` movements, and transaction rollback;
- refund modal validation, authorization visibility, retry/error state, and sale
  refresh;
- voided-sale exclusion from all reporting and finance calculations;
- full-only direct rent payments and concurrent/reserved-balance rejection;
- full accumulated rent offset success, insufficient-payout rejection, stale
  preview revalidation, and oldest-first complete allocation;
- accrued, collected, adjusted, and outstanding rent definitions;
- live summary totals with more than 20 merchants and active filters;
- pagination boundaries, filter resets, empty pages, and stale response handling
  for payables, receivables, Merchant Activity, and settlement history;
- removed paths returning 404 and retained routes remaining in OpenAPI.

API wrapper tests alone are insufficient for financially sensitive workflows.
Add focused component tests for refund and rent interactions plus backend E2E
tests that exercise controller validation, authorization metadata, and response
contracts.

## Documentation Updates During Implementation

After each part, update only the relevant current references:

- `workflows/pos-and-refunds.md`
- `workflows/settlements-and-payouts.md`
- `workflows/reporting.md`
- `architecture/financial-integrity.md`
- affected milestone summaries when historical implemented behavior changes

Swagger/OpenAPI remains the route-level source of truth. Remove deleted routes
from documentation rather than maintaining a deprecated-route catalog.

## Suggested Commit Sequence

1. `fix(reports): exclude voided sales and clarify rent metrics`
2. `feat(refunds): complete sale refund workflow`
3. `fix(finance): enforce full rent payments and offsets`
4. `refactor(finance): add authoritative summaries and pagination`
5. `refactor(api): remove unused routes and clients`
6. `test(api): align contracts and finance workflows`
7. `docs: align refund finance and reporting references`

Each commit should keep backend and frontend contracts synchronized. If a part
temporarily requires a breaking request/response change, its server, client,
tests, and current documentation belong in the same commit.

## Validation Gates

Run after every relevant part:

```text
Backend: lint, build, unit tests, E2E tests, Prisma validate
Frontend: lint, typecheck, unit/component tests, production build
Repository: formatting checks, unused-route searches, git diff check
```

Database-connected finance tests must verify rollback and concurrency behavior.
Mock-controller tests alone do not establish financial integrity.

## Definition of Done

- Owners/managers can record valid item refunds from Sale Details.
- Refunds restore inventory and create auditable return movements atomically.
- Voided sales cannot be refunded and never affect reports or merchant finance.
- Direct rent payments and payout deductions cannot partially pay rent.
- Rent accrued, collected, adjusted, and currently outstanding are distinct.
- Live summary cards represent all matching merchants.
- Every applicable Finance list is navigable in 20-row pages.
- Removed backend routes have no remaining frontend, test, documentation, or
  OpenAPI references.
- Tenant isolation, role authorization, immutable history, and decimal-safe
  calculations are preserved.
- Backend and frontend validation suites pass without stale expectations.
