# Milestone 3 — Spaces and Agreements

**Status:** Completed and extended

## Goal

Represent where merchants operate physically and how the concept store earns
rent, commission, or both.

## Delivered

- Branch-owned physical spaces with standard and custom types.
- Space lifecycle management for owners and managers.
- Agreement-selected, dated space reservations and assignment history.
- Exclusive date-range occupancy enforcement, including legacy assignments.
- Draft, submission, approval, activation, ending, and suspension lifecycle.
- Five draft slots, one pending agreement, and one active agreement per merchant.
- Philippine activation scheduling and automatic lifecycle reconciliation.
- Optional security-deposit and first-rent approval prerequisites with
  append-only ledgers.
- Configurable monthly rent collection week and weekday.
- Fixed-rent, commission-only, and hybrid commercial terms.
- Weekly, semi-monthly, and monthly settlement schedules.
- An organization agreement register and guided agreement workflow.
- Authenticated frontend navigation and operational layout refinement.

## Important rules

- A space belongs to exactly one organization branch.
- Agreements are the only source of new space assignments.
- Pending, approved, and active reservations cannot overlap on a space.
- A merchant may occupy multiple spaces and branches.
- Assigned merchants must participate in the selected branch.
- Legacy manual assignments are read-only history with an end action.
- Submitted commercial terms are immutable.
- An agreement must define fixed rent, commission, or both.
- Approval is blocked until enabled deposit and first-rent prerequisites are
  fully collected.

## Security and integrity result

Composite tenant and branch relationships protect cross-organization and
cross-branch references. Services validate related objects inside transactions,
and database constraints protect important uniqueness and historical links.

## Explicit exclusions at completion

Products, inventory, sales, settlement calculations, custom schedules, and
automatic billing were deferred.

## Current reference

- [Merchants, spaces, and agreements](../workflows/merchants-and-agreements.md)
