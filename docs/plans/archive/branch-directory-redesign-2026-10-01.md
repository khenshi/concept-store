# Branches directory redesign

**Status:** Implemented October 1, 2026.

## Delivered

- Added persisted `BranchStatus` lifecycle metadata with an `ACTIVE` default.
- Added the staff-only paginated branch directory projection with search,
  status filtering, summary counts, fixed ten-row pages, and distinct current
  product-placement merchant counts.
- Added owner/assigned-manager status changes while preserving branch access,
  POS, inventory, sales, and merchant identity-only privacy behavior.
- Rebuilt the staff Branches page with compact metrics, filters, an accessible
  table, status treatments, and pagination while retaining the existing header.
- Updated branch details, frontend/backend contracts, focused tests, and module
  documentation.

## Verification

- Prisma client generation and backend build passed.
- Branch backend tests and focused branch frontend tests passed.
- Impeccable layout detector reported no deterministic design-quality issues for
  the edited branch management and detail components.
