# Kapwesto Documentation

Use this index to find the smallest authoritative document for a task. Current
behavior lives in `architecture/` and `workflows/`; delivery history lives in
`milestones/` and `plans/archive/`.

## Agent and developer reading order

1. Read [`AGENTS.md`](../AGENTS.md) for scope, security, and delivery rules.
2. Read [`current plan`](plans/current.md) for the only active execution plan.
3. Read only the architecture and workflow references relevant to the task.
4. Consult milestone summaries or archived plans only for historical context.

If documents disagree, use this precedence order:

1. `AGENTS.md` and the explicitly assigned task
2. `docs/plans/current.md`
3. current architecture and workflow references
4. completed milestone summaries
5. archived implementation plans

## Start here

- [System overview](architecture/system-overview.md)
- [Tenancy and security](architecture/tenancy-and-security.md)
- [Financial integrity](architecture/financial-integrity.md)
- [Frontend architecture](architecture/frontend-architecture.md)
- [Development database seeding](development/database-seeding.md)

## Current workflows

- [Merchants, spaces, and agreements](workflows/merchants-and-agreements.md)
- [Products and inventory](workflows/products-and-inventory.md)
- [POS, payments, and refunds](workflows/pos-and-refunds.md)
- [Settlements and payouts](workflows/settlements-and-payouts.md)
- [Performance and scalability audit](performance-scalability-audit.md)
- [Reporting and dashboards](workflows/reporting.md)

These documents describe current behavior. Swagger/OpenAPI is the authoritative
endpoint-level reference when the backend is running with documentation enabled.

## Plans

- [Current plan](plans/current.md) — the single source of truth for active work
- [Archived plans](plans/archive/README.md) — completed or superseded execution
  records

An archived plan explains why work was done but does not define current product
behavior. Promote only one approved plan to `current.md` at a time, then archive
it when its definition of done is met.

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
- Keep the single active execution plan in `plans/current.md`. Roadmap entries
  and archived plans are context, not implementation authorization.
- Give archived plans a final status and links to authoritative current
  references.
- Keep one milestone summary instead of a file for every implementation part.
- Use Swagger/OpenAPI rather than duplicating complete endpoint schemas.
- Mark planned behavior clearly; roadmap context is not implemented behavior.
- Update the relevant current reference and milestone summary in the same change.
- Rely on Git history for superseded implementation notes.
