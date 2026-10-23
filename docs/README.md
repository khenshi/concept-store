# Kapwesto Documentation

Documentation is separated by purpose:

- [`AGENTS.md`](../AGENTS.md) contains global engineering rules and system
  architecture.
- [`modules/`](modules/) contains one current-behavior reference per implemented
  system module.
- [`plans/current.md`](plans/current.md) contains the proposed or approved work
  for the next implementation.
- [`plans/archive/`](plans/archive/) contains completed and superseded plans that
  are not active requirements.
- [`development/`](development/) contains development and operational guides.
- [Deployment readiness checklist](deployment-readiness-checklist.md) tracks
  observed release blockers, required features, pilot hosting and launch gates.

## Implemented modules

- [Authentication and accounts](modules/authentication-and-accounts.md)
- [Organizations](modules/organizations.md)
- [Branches](modules/branches.md)
- [Organization memberships](modules/organization-memberships.md)
- [Organization invitations](modules/organization-invitations.md)
- [Merchant profiles](modules/merchant-profiles.md)
- [Products](modules/products.md)
- [Branch inventory](modules/branch-inventory.md)
- [Merchant–branch participation](modules/merchant-branches.md)
- [Sales history, merchant own-sale views and internal receipts](modules/sales.md)
- [Branch POS catalog, cart and payment confirmation](modules/pos.md)
- [Returns and manual refunds](modules/refunds.md)
- [Sales Reports](modules/reports.md)
- [Spaces and occupancy](modules/spaces.md)
- [Frontend experience](modules/frontend-experience.md)

Branch and merchant access control is implemented across memberships, invitations,
branches, merchant profiles, products, and inventory. Owners manage access;
managers/cashiers require assignments, while linked merchants read only their own
business and selling-branch stock. Rendered QA was explicitly waived for this
milestone; automated verification does not certify rendered accessibility.

Branch POS checkout and sales history are implemented, including cash/manual
GCash/card confirmation, atomic stock deductions, safe same-ID retries, staff
internal receipts and merchant own-item historical views. The user separately
waived rendered responsive, keyboard/dialog, zoom and print QA for this milestone
on September 13, 2026; automated tests do not certify rendered layout or printing.

## Planning

- [Current implementation plan](plans/current.md)
- [Pending plans and implementation sequence](plans/pending/README.md)
- [Archived plans](plans/archive/README.md)

Archived documents and the pre-rollback branch are historical context only and
do not authorize further implementation.

## Development

- [Database seeding](development/database-seeding.md)
