# Frontend Public-Surface Tailwind Refactor

## Scope

The refined landing, login, and account-creation pages were migrated from page-specific global CSS to Tailwind utility classes. Their content, behavior, responsive intent, and visual direction were preserved.

This part does not convert the authenticated operational workspace. Its existing global classes remain in place to avoid mixing a public-surface cleanup with an application-wide visual rewrite.

## Changes

- moved landing-page layout, spacing, color, typography, responsive, and illustrative-preview styles into `page.tsx`
- moved authentication presentation and responsive styles into `credentials-form.tsx` and the authentication route pages
- added a small shared `BrandWordmark` component used by the landing and authentication surfaces
- removed obsolete landing and authentication selectors from `globals.css`
- reduced `globals.css` from approximately 1,983 lines to 994 lines
- retained global design tokens, base element behavior, accessibility helpers, and styles used by authenticated operational screens

## Styling Convention

For new frontend work:

- prefer Tailwind utilities for component and page presentation
- keep `globals.css` for global tokens, base behavior, and styles not yet migrated
- extract a component only when markup or behavior is genuinely reused
- avoid replacing utilities with a large custom abstraction layer

The remaining operational CSS can be migrated incrementally when those screens are intentionally refined. It should not block feature work or trigger a broad visual refactor by default.

## Validation

- ESLint
- TypeScript type checking
- 35 frontend tests
- Next.js production build
- Prettier formatting check
- Git whitespace validation

## Explicit Exclusions

- no authentication behavior changes
- no backend changes
- no authenticated-workspace redesign
- no new dependency
- no Milestone 3 functionality
