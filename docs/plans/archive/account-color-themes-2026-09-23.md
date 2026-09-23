# Account Color Themes

**Status:** Approved September 23, 2026; implemented September 23, 2026.

The original accent-only scope was expanded to complete light palettes on
September 23, 2026.

## Scope

- Add Graphite, Ocean, Forest, and Plum light color themes to Account settings.
- Apply each theme to signed-in canvas, surfaces, text, borders, controls,
  actions, selected states, and focus styling.
- Save the choice on each user account and apply it to signed-in pages across
  devices and organization memberships.
- Keep public and sign-in pages on the existing brand palette.
- Include authenticated theme validation and responses, accessible selection
  and feedback, contrast checks, tests, and module documentation.

## Exclusions

- No custom colors, dark mode, or organization branding.
- No change to business data, roles, tenant boundaries, or semantic status
  colors.

## Validation

- Prisma schema validation and client generation.
- Backend focused unit tests, HTTP e2e tests, lint, format check, and build.
- Frontend focused tests, lint, format check, typecheck, and production build.
- Text, action, focus, control, and semantic status contrast was checked on
  the corresponding light surfaces for all four palettes.
