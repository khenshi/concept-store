# Sales Reports Chart Refresh

**Status:** Implemented and archived September 25, 2026.

## Delivery

- Replaced the owner/manager chart rows with one full-width daily line chart for
  Net Sales, Gross Sales or Refunds. Net Sales is selected by default; accessible
  radio controls switch metrics and exact daily values follow the applied
  report range. Negative net values remain below the zero baseline.
- Kept Top Products and Top Merchants horizontal gross-sales charts and limited
  each to the first five ranked rows. The detailed product table retains every
  analytics row.
- Added Average Sales by Weekday, using gross daily sales divided by the count
  of each weekday across all dates in the selected Manila range. Zero-sales
  dates count toward the average; absent weekdays display “No dates”; values
  round to the nearest cent.
- Kept one gross Payment Method donut using existing payment totals.
- Made the performance charts side by side when space allows. At medium widths,
  the weekday chart uses two-thirds of its row and the payment donut one-third;
  these panels stack on narrow phones.
- Left Merchant analytics and all APIs, DTOs and database behavior unchanged.
  Updated `docs/modules/reports.md`.

## Verification

- Frontend Reports tests: 168 passed across ten files.
- Changed-file formatting, lint and typecheck passed.
- Production build passed with the existing multiple-lockfile workspace-root
  warning.
- Safari viewport review at 390×844, 834×1194, 1180×820 and 1600×900 confirmed
  phone stacking, the medium-width two-thirds/one-third split, side-by-side
  performance charts where space permits and no page-level horizontal
  overflow. The review included populated and empty report periods.

## Assumptions

Weekday averages use gross sales. Because the repository has no branch closure
records, every date in the selected Manila range counts, including dates with
no sales. Excluding closed dates requires a separately approved
closure-tracking capability.
