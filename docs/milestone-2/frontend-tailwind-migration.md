# Frontend Tailwind Migration

## Scope

All existing frontend presentation was migrated to Tailwind utilities. This includes public pages, authentication, the authenticated shell, organization entry and overview, branch management, organization membership, and merchant management.

No API behavior, validation rule, authorization rule, or application workflow was intentionally changed.

## Styling Standard

Tailwind is now the default styling approach for all new and existing frontend work:

- component and page presentation belongs in Tailwind utility classes
- responsive behavior uses Tailwind breakpoints and variants
- state styles use explicit, statically discoverable Tailwind class mappings
- shared React components are extracted only when markup or behavior is genuinely reused
- `globals.css` is reserved for the Tailwind import and document-level base rules

Do not add page-specific or feature-specific selectors to `globals.css`.

## Migrated Areas

- public landing page
- login and account creation
- authentication loading and error states
- authenticated application shell and header
- organization selection, creation, navigation, and overview
- branch directory and branch form
- organization-member directory, role controls, and add-member form
- merchant directory, filters, profile, lifecycle status, and branch assignments

## Global Stylesheet

`frontend/src/app/globals.css` was reduced from approximately 1,983 lines before the public-page refactor to 21 lines. It now contains only:

- the Tailwind import
- document background and foreground defaults
- inherited form-control typography
- a consistent global keyboard focus outline

## Design Preservation

The migration retains the approved Clear Store Ledger direction: neutral slate surfaces, restrained emerald actions, bordered operational panels, clear typography, visible focus states, and responsive task order.

## Validation

- ESLint with zero warnings
- TypeScript type checking
- full frontend test suite
- Next.js production build
- Prettier formatting check
- Git whitespace validation

## Explicit Exclusions

- no backend changes
- no feature or data-model changes
- no new styling or component dependency
- no Milestone 3 functionality
