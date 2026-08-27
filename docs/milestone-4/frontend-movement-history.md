# Frontend Inventory Movement History

## Scope

This part completes the Milestone 4 inventory audit interface for owners and managers.

## Implemented behavior

- separate Current stock and Movement history views
- movement data fetched only after history is first opened
- branch, product, and movement-type filters
- cursor-based next and previous page navigation
- signed quantity changes with explicit positive and negative treatment
- movement type, branch, responsible user, date, time, note, and reference display
- loading, empty, and request-error states
- Philippine date/time presentation using the `Asia/Manila` time zone

## Data and cache behavior

The movement component stays mounted after first use, preserving its page and filters across ordinary view switching. Stock-in and adjustment operations invalidate that cached history version. If history is hidden, refresh waits until the user opens it again; otherwise it refreshes immediately from the backend.

Cursor navigation keeps a local stack of previously visited cursors. The backend validates each cursor against the organization and active filters.

## Design

The history view uses the same flat operational panel, filter controls, divided list rows, compact code/status labels, and emerald interaction language defined in `DESIGN.md`. Quantity color supplements explicit signed numbers and does not carry meaning by itself.

## Explicit exclusions

This part does not add exports, movement editing, low-stock alerts, sales movements, merchant self-service, or offline synchronization.

