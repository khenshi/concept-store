# Milestone 3 — Spaces and Agreements

**Status:** Completed historical summary

## Goal

Represent where merchants operate physically and how the concept store earns
rent, commission, or both.

## Delivered

- Branch-owned physical spaces with standard and custom types.
- Space lifecycle management for owners and managers.
- Dated merchant-to-space assignment history.
- Exclusive active-space assignment enforcement.
- Merchant agreements with effective dates and lifecycle state.
- Fixed-rent, commission-only, and hybrid commercial terms.
- Weekly, semi-monthly, and monthly settlement schedules.
- Contextual branch and merchant workflows for spaces, assignments, and
  agreements.
- Authenticated frontend navigation and operational layout refinement.

## Important rules

- A space belongs to exactly one organization branch.
- A space has at most one active assignment at a time.
- A merchant may occupy multiple spaces and branches.
- Assigned merchants must participate in the selected branch.
- Assignment and agreement history is ended, not overwritten or deleted.
- An agreement must define fixed rent, commission, or both.
- Effective agreement periods cannot create ambiguous active terms.

## Security and integrity result

Composite tenant and branch relationships protect cross-organization and
cross-branch references. Services validate related objects inside transactions,
and database constraints protect important uniqueness and historical links.

## Explicit exclusions at completion

Products, inventory, sales, settlement calculations, custom schedules, and
automatic billing were deferred.

## Current reference

- [Merchants, spaces, and agreements](../workflows/merchants-and-agreements.md)
