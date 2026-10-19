# Shared operational table shell

**Status:** Implemented locally October 19, 2026.

## Goal

Provide one shared presentation shell for semantic report tables and responsive
operational collections without replacing feature-owned columns, rows, loading
states, filters or data behavior.

## Implemented scope

- Added `OperationalTable` for shared semantic table viewport and base classes.
- Added `OperationalTableFrame` for shared empty-state inset and footer slots.
- Migrated Reports Transactions, Daily Data and Rankings tables.
- Migrated Inventory stock, movement records, movement history, integrity, and
  Spaces list/history collections where the existing structure permitted it.
- Preserved feature-owned columns, responsive grids, loading/error states,
  filters, actions, numbered pagination, cursor pagination and Load more behavior.

## Exclusions

- No column-schema abstraction was introduced.
- No table columns, API contracts, query behavior or backend code changed.
- Responsive list collections remain semantic lists rather than being converted
  into native HTML tables.

## Validation

- Shared/Inventory/Spaces focused tests: 72 passed.
- Frontend typecheck: passed.
- Frontend lint: passed.
- Prettier formatting: passed for changed implementation and plan files.
- The broader Reports component run retains four pre-existing copy/selector
  failures unrelated to this table-shell refactor.
