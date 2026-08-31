# Frontend Architecture

**Status:** Current reference

## Application structure

The Next.js application separates public authentication pages from protected
organization workspaces. Organization routes share a provider that loads the
authenticated organization, branches, merchants, and products on demand.

Feature folders contain API clients, types, schemas, views, and focused tests.
The frontend consumes backend responses as authoritative records and does not
duplicate financial business logic.

## Organization workspace

The authenticated shell provides:

- organization switching;
- role-aware navigation;
- responsive desktop and mobile layouts;
- consistent page headers, operational panels, tables, filters, notices, and
  confirmation dialogs; and
- loading, empty, error, success, and pending states.

Owner and manager navigation exposes administration, finance, and reports.
Cashiers primarily see POS. Merchant users receive their isolated dashboard.

## Interaction conventions

- Destructive or access-changing actions require confirmation.
- Forms validate user input before API submission while treating backend
  validation as authoritative.
- Tables retain semantic captions, column headers, and row headers.
- Focus-visible styles, skip navigation, labels, alert roles, and status regions
  support keyboard and assistive-technology use.
- Responsive tables preserve meaning through horizontal overflow rather than
  collapsing unrelated fields.

## Styling

Tailwind CSS is the styling standard. Shared controls establish consistent
spacing, borders, colors, focus treatment, and responsive behavior. The visual
language uses restrained emerald accents, slate neutrals, strong headings, and
compact operational density.

## Data loading

Reusable organization context loaders deduplicate branch, merchant, and product
requests. Feature pages own their specific filters and mutation state. Reports
load one active dataset at a time to avoid unnecessary remote database work.

## Future offline boundary

The current frontend is online-first. Offline support should be limited to the
POS-critical catalog, cart, payment, local sale queue, and idempotent sync. The
administration and finance workspaces remain online-only unless the offline
milestone explicitly changes that boundary.
