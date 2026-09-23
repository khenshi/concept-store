# Reports Period Controls

**Status:** Implemented and archived September 24, 2026.

## Scope

- Place the Report period heading, Philippines date inputs, Apply period action,
  and Refresh report action on one row at desktop widths.
- Keep the controls responsive by stacking or wrapping them on narrower screens.
- Preserve existing labels, date guidance, applied-period text, validation,
  disabled states, and read-only report behavior.

## Exclusions

- No report API, query, date semantics, or access changes.
- No changes to report results or other report-page sections.

## Validation

- Changed-file Prettier check, ESLint, TypeScript typecheck, and production build
  passed.
- The production build reported the existing multiple-lockfile root inference
  warning.
