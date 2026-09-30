# Current Plan

## Reports ranking tablet adaptation

Approved scope for the Reports Rankings responsive refinement:

- Make the selected ranking metric and applied merchant scope visible beside the
  ranking controls.
- Keep rank, product, merchant, the active metric, and net visible in the
  primary tablet row; move SKU/barcode and supporting return/refund values into
  compact secondary product metadata below the tablet breakpoint.
- Reduce tablet table width and keep the rank/product identity columns fixed
  while supporting metrics scroll horizontally when necessary.
- Reserve the merchant filter width and expose clear loading/error status without
  changing ranking requests, role scope, pagination, or merchant privacy.
- Update Reports tests and module documentation, then archive this plan after
  implementation.

Explicit exclusions: no backend, schema, API, authorization, totals, sorting
semantics, date behavior, or report-tab changes.
