# Sales Reports Charts

**Status:** Implemented and archived September 24, 2026.

## Scope

- Arrange the owner/manager analytics charts in three responsive rows on a
  12-column grid at large widths: existing separate sales trend charts span 8
  columns beside a 4-column gross-payment donut; merchant and product gross-sales
  bars each span 6 columns; average sales spans all 12 columns. Stack panels at
  narrower widths.
- Build the payment donut from gross sale payment totals. Replace the gross-payment
  list with the donut and keep actual refund methods in a separate panel.
- Add horizontal bars for the top ten merchants by gross sales, aggregating all
  matching sale items by merchant ID. Label each merchant with its latest
  contributing saved name and break equal-sales ties by merchant ID. Keep the
  chart in the owner/manager view.
- Add horizontal bars for existing top products by gross sales and retain the
  detailed product table.
- Define average sales as each Asia/Manila date's gross sales divided by its
  completed transaction count, rounded to the nearest cent. Dates without sales
  have a zero average. Show a full-width bar chart.
- Extend only the staff analytics response with merchant aggregates. Update its
  response DTO, OpenAPI contract and strict frontend schema. Keep the merchant
  response unchanged. Add no route or database migration.
- Give charts accessible titles, labels and values, explicit zero-data states,
  and meaning that does not depend on color alone.
- Update `docs/modules/reports.md` after implementation.

## Exclusions

- No changes to merchant report responses, summary endpoints, routes,
  authorization rules, database schema or migrations.
- No gross-payment method list alongside the replacement donut.
- Keep actual refund methods separate from gross sale payment totals.
- Retain the detailed top-products table and the two separate trend charts.
- No profit, payout, cash-availability or refund-netted payment interpretation.

## Validation

- Backend analytics tests cover aggregation, tenant/branch/date scoping, saved
  labels, deterministic ranking and the top-ten limit.
- Frontend tests cover strict response parsing, chart values and accessibility,
  empty states and responsive grid classes.
- Backend formatting, lint, build, focused unit tests, Reports HTTP/OpenAPI tests
  and Reports PostgreSQL integration tests passed. The integration tests used a
  temporary PostgreSQL 17 container on a random localhost port; it was stopped
  and removed after the run.
- Frontend changed-file formatting, lint, typecheck, production build and all 161
  Reports tests across 10 files passed. The build emitted the existing
  multiple-lockfile workspace-root warning.
- Responsive behavior is covered through mobile-default stacking and large-screen
  grid-class assertions. A rendered browser viewport review was not performed.
