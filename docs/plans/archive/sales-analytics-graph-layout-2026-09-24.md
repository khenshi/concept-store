# Sales Analytics Graph Layout

**Status:** Implemented and archived September 24, 2026.

## Summary

Arrange owner/manager analytics into three rows. Row one contains gross sales,
actual refunds and net sales by payment method. Keep merchant and product charts
in row two. Row three contains daily gross sales, refunds and net recorded sales
as bar charts; remove the average-sales chart.

## Implementation

- Use gross sale methods for the gross donut and actual refund methods for the
  refund donut. Add staff-only per-method net totals, calculated as gross sales
  in the selected sale period minus refunds processed in the selected refund
  period, attributed to each original Sale payment method. Totals must reconcile
  to overall net recorded sales.
- Size net donut slices by absolute net amount and show exact signed values and
  direction in text. Label the attribution clearly; refund methods remain actual
  refund methods.
- Render daily gross, refunded and net recorded amounts from Asia/Manila trends
  as three bar charts. Negative net bars extend below zero. Keep exact accessible
  values and empty states, and prevent page-level overflow at tablet widths.
- Use three columns in iPad landscape and wider layouts, two columns in iPad
  portrait, and stack panels on narrow phones. Preserve the merchant/product
  charts and detailed product table in row two.
- Extend the existing staff analytics DTO, OpenAPI contract and strict frontend
  schema only. Keep the existing route and merchant response unchanged; add no
  database migration. Update `docs/modules/reports.md` after implementation.

## Validation

- Test original-method refund attribution, actual-method differences, date and
  tenant/branch scoping, signed values and reconciliation in backend analytics.
- Test strict response parsing, chart values, negative/zero states, accessibility
  and responsive layout in frontend analytics.
- Backend formatting, lint and build passed, along with 37 Reports unit tests,
  30 Reports HTTP/OpenAPI tests and 45 PostgreSQL Reports integration tests. The
  integration tests used a temporary PostgreSQL 17 container on a random
  localhost port; it was stopped and removed after the run.
- Frontend changed-file formatting, lint, typecheck, production build and 165
  Reports tests across 10 files passed. The build emitted the existing
  multiple-lockfile workspace-root warning.
- Responsive behavior is covered by mobile-default stacking and tablet
  portrait/landscape grid-class assertions. Safari viewport review at
  834×1194, 1194×834 and 1600×820 confirmed the two/three-column chart rows fit
  without page-level horizontal overflow. The browser review used an empty
  report period.
