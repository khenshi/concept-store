# Current Implementation Plan

**Status:** Approved September 19, 2026. Implement as one reviewable,
uncommitted presentation part; commit only after user review.

## Global Poppins typography

### Intent

Replace the current Inter web font with Poppins across the public landing page,
authentication flows and authenticated organization workspace while preserving
the existing Kapwesto visual system.

### Scope

- Replace the `next/font/google` font loaded by the root layout.
- Update `DESIGN.md` and frontend module documentation to make Poppins the
  canonical family.
- Preserve all existing type sizes, weights, line heights, tracking, colors,
  layout, responsive behavior and fallback font behavior.

Explicitly excluded: component redesign, spacing changes, color changes, route,
API, database, authorization, tenant/branch behavior and business logic changes.

### Acceptance checks

- All application routes inherit Poppins from the root layout.
- Existing typography tokens and component classes remain unchanged apart from
  the family declaration.
- Frontend tests, typecheck, lint, production build and diff checks pass.
- No unrelated working-tree files are staged or changed.
