# Overview, Members, and Accessibility Pass

## Part 5 scope

This final refactor part aligns the organization overview and Members page with the authenticated information architecture, then applies shared accessibility improvements to the authenticated shell and operational tables.

## Organization overview

The overview presents only currently implemented owner/manager work areas:

- **Operations:** Products and Inventory
- **Business:** Merchants, Branches, and Members

Spaces are intentionally absent as an independent overview destination. Space and assignment management remains available contextually through Branch and Merchant workflows. No future POS or Finance destinations are displayed.

## Members

- Members are displayed in a responsive operational access table.
- Account email, join date, organization role, and available action are separated into clear columns.
- Owners retain role-change and removal controls.
- Managers retain their read-only member view.
- The page explicitly explains that current roles apply across the organization and that branch-specific access is not configured.
- The existing registered-account requirement and validated Add Member form are unchanged.

## Accessibility and consistency

- Authenticated pages now provide a keyboard-visible skip link to the main content.
- The main content region can receive programmatic focus.
- Sidebar destinations use a consistent visible keyboard-focus treatment.
- Product, Inventory, and Member tables include descriptive accessible captions.
- Tables use column headers and row headers to preserve meaningful relationships for assistive technology.
- Responsive overflow retains table semantics at tablet widths.

## Preserved behavior

- Tenant isolation and backend-authoritative authorization
- Owner and manager role boundaries
- Organization membership API contracts
- Existing loading, empty, error, success, and pending states
- Existing Products, Inventory, Branch, Merchant, Space, and Agreement behavior

## Explicit exclusions

- Branch-specific member access
- POS, sales, payments, settlements, payouts, reports, offline behavior, or billing
- Backend or database changes

## Validation

- Prettier formatting
- TypeScript checking
- ESLint
- Frontend tests
- Next.js production build
- Git whitespace validation
