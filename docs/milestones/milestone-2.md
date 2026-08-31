# Milestone 2 — Merchant Management

**Status:** Completed historical summary

## Goal

Allow concept stores to manage independent merchants centrally without
confusing merchant business records with authenticated user accounts.

## Delivered

- Tenant-owned merchant records with contact details, optional code, and
  lifecycle status.
- Merchant creation, listing, filtering, retrieval, editing, and status changes.
- Active, inactive, suspended, and ended merchant statuses.
- Many-to-many merchant participation across organization branches.
- Owner/manager merchant directory and profile workflows.
- Branch assignment during creation and later profile editing.
- Public and authentication page visual refinement and Tailwind consolidation.

## Important rules

- Merchant codes are unique within an organization when present.
- A merchant may operate in several branches.
- Branch participation does not imply occupation of a physical space.
- Merchant records remain separate from organization memberships and login
  accounts.
- All merchant and branch identifiers are validated within the active tenant.
- Status changes preserve merchant history rather than deleting operational
  records.

## Security result

Owner and manager access is enforced by backend guards. Creation and update
requests cannot select a foreign organization, and branch assignment updates
validate every branch before replacing the relationship.

## Explicit exclusions at completion

Space assignments, agreements, merchant login linking, products, inventory,
sales, settlements, and payouts were not implemented in this milestone.

## Current reference

- [Merchants, spaces, and agreements](../workflows/merchants-and-agreements.md)
