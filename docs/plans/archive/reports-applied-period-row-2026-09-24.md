# Reports Applied Period Row

**Status:** Implemented and archived September 24, 2026.

## Scope

- Place Refresh report on the same responsive row as the applied-period text.
- Remove the divider immediately above the applied-period row.
- Keep the date filter and report refresh behavior unchanged.

## Exclusions

- No report API, query, date semantics, or access changes.
- No changes to other report-page sections.

## Validation

- Changed-file Prettier check, ESLint, TypeScript typecheck, and production build
  passed.
- The production build reported the existing multiple-lockfile root inference
  warning.
