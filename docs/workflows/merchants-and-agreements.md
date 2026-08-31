# Merchants, Spaces, and Agreements

**Status:** Current reference

## Merchant management

Merchants are tenant-owned independent brands. Owners and managers can create,
view, update, and change merchant lifecycle status. Merchant codes are unique
within an organization when present.

A merchant may operate in multiple branches. Branch participation is stored as
a separate tenant-scoped relationship and is distinct from occupying a physical
space.

## Spaces and assignments

Spaces belong to branches and represent racks, shelves, cabinets, booths,
tables, drawers, or custom physical areas.

- A space can have at most one active merchant assignment at a time.
- A merchant may hold several assignments across branches.
- Assignments retain start and end dates so occupancy history is preserved.
- The assigned merchant must belong to the organization and operate in the
  space's branch.
- Ending an assignment does not delete its history.

## Commercial agreements

Agreements describe how the store earns from a merchant. Supported terms are:

- fixed rent only;
- commission only; or
- fixed rent plus commission.

Agreements contain effective dates, optional fixed rent, optional commission,
settlement schedule, and lifecycle status. A merchant is not encoded as a
different type for each commercial model.

Active agreement periods cannot create ambiguous overlapping commercial terms.
Historical agreements are retained and settlement calculations snapshot the
terms that applied to each segment of a period.

## Settlement schedules

Initial schedules are weekly, semi-monthly, and monthly. Custom scheduling is
not implemented. Closed scheduled periods are handled by the settlement
workflow.

## Access

Owners and managers administer merchants, spaces, assignments, and agreements.
Merchant self-service is read-only and limited to the merchant explicitly linked
to the authenticated membership.
