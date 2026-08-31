# Concept Store Documentation

This directory contains current architecture and workflow references plus one
historical summary for each completed milestone.

## Start here

- [System overview](architecture/system-overview.md)
- [Tenancy and security](architecture/tenancy-and-security.md)
- [Financial integrity](architecture/financial-integrity.md)
- [Frontend architecture](architecture/frontend-architecture.md)

## Current workflows

- [Merchants, spaces, and agreements](workflows/merchants-and-agreements.md)
- [Products and inventory](workflows/products-and-inventory.md)
- [POS, payments, and refunds](workflows/pos-and-refunds.md)
- [Settlements and payouts](workflows/settlements-and-payouts.md)
- [Reporting and dashboards](workflows/reporting.md)

These documents describe current behavior. Swagger/OpenAPI is the authoritative
endpoint-level reference when the backend is running with documentation enabled.

## Completed milestones

- [Milestone 1 — SaaS and Multi-Tenant Foundation](milestones/milestone-1.md)
- [Milestone 2 — Merchant Management](milestones/milestone-2.md)
- [Milestone 3 — Spaces and Agreements](milestones/milestone-3.md)
- [Milestone 4 — Products and Inventory](milestones/milestone-4.md)
- [Milestone 5 — Online POS](milestones/milestone-5.md)
- [Milestone 6 — Merchant Finance](milestones/milestone-6.md)
- [Milestone 7 — Reporting and Dashboards](milestones/milestone-7.md)

Milestone summaries are historical records. When a summary and a current
workflow reference differ, the current workflow reference is authoritative.

## Documentation rules

- Document current business behavior, security boundaries, financial rules,
  and durable architecture decisions.
- Keep one milestone summary instead of a file for every implementation part.
- Use Swagger/OpenAPI rather than duplicating complete endpoint schemas.
- Mark planned behavior clearly; roadmap context is not implemented behavior.
- Update the relevant current reference and milestone summary in the same change.
- Rely on Git history for superseded implementation notes.
