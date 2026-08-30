# Concept Store Documentation

All project documentation is maintained in this directory and organized by milestone.

## Architecture

- [Technology stack](tech-stack.md)
- [Owner and manager frontend workflows](frontend-owner-manager-workflows.md)
- [Authenticated application shell](frontend-authenticated-shell.md)
- [Operational page structure](frontend-operational-page-structure.md)
- [Branch and merchant workspaces](frontend-branch-merchant-workspaces.md)
- [Product and inventory tables](frontend-product-inventory-tables.md)
- [Overview, members, and accessibility](frontend-overview-members-accessibility.md)
- [Unified dropdowns and confirmations](frontend-unified-controls.md)

## Milestone 1 — SaaS / Multi-Tenant Foundation

- [Security audit](milestone-1/security-audit.md)
- [Backend initialization](milestone-1/backend-initialization.md)
- [Prisma 7 configuration](milestone-1/prisma-7-configuration.md)
- [Frontend initialization](milestone-1/frontend-initialization.md)
- [Authentication foundation](milestone-1/authentication-foundation.md)
- [Authentication session persistence](milestone-1/authentication-session-persistence.md)
- [Authentication session endpoints](milestone-1/authentication-session-endpoints.md)
- [Frontend authentication foundation](milestone-1/frontend-authentication-foundation.md)
- [Frontend authentication UI](milestone-1/frontend-authentication-ui.md)
- [Frontend brand alignment](milestone-1/frontend-brand-alignment.md)
- [Frontend organization entry](milestone-1/frontend-organization-entry.md)
- [Organizations and membership foundation](milestone-1/organizations-and-memberships.md)
- [Initial organization RBAC](milestone-1/initial-rbac.md)
- [Branch data model](milestone-1/branch-data-model.md)
- [Branch API and authorization](milestone-1/branch-api.md)
- [Frontend branch management](milestone-1/frontend-branch-management.md)
- [Backend completion](milestone-1/backend-completion.md)
- [Frontend completion](milestone-1/frontend-completion.md)
- [Swagger API documentation](milestone-1/swagger-api-documentation.md)

## Milestone 2 — Merchant Management

- [Security audit](milestone-2/security-audit.md)
- [Merchant data model](milestone-2/merchant-data-model.md)
- [Merchant API](milestone-2/merchant-api.md)
- [Merchant branch assignments](milestone-2/merchant-branch-assignments.md)
- [Backend completion](milestone-2/backend-completion.md)
- [Frontend completion](milestone-2/frontend-completion.md)
- [Frontend merchant branch assignments](milestone-2/frontend-merchant-branch-assignments.md)
- [Frontend landing page refinement](milestone-2/frontend-landing-page-refinement.md)
- [Frontend authentication page refinement](milestone-2/frontend-auth-page-refinement.md)
- [Frontend public-surface Tailwind refactor](milestone-2/frontend-tailwind-refactor.md)
- [Frontend Tailwind migration](milestone-2/frontend-tailwind-migration.md)

## Milestone 3 — Spaces and Agreements

- [Security audit](milestone-3/security-audit.md)
- [Milestone completion](milestone-3/completion.md)
- [Backend design](milestone-3/backend-design.md)
- [Space and assignment data model](milestone-3/space-assignment-data-model.md)
- [Space CRUD API](milestone-3/space-api.md)
- [Space assignment API](milestone-3/space-assignment-api.md)
- [Merchant agreement data model](milestone-3/merchant-agreement-data-model.md)
- [Merchant agreement API](milestone-3/merchant-agreement-api.md)
- [Backend completion](milestone-3/backend-completion.md)
- [Frontend application foundation](milestone-3/frontend-foundation.md)
- [Frontend space management](milestone-3/frontend-space-management.md)
- [Frontend space assignments](milestone-3/frontend-space-assignments.md)
- [Frontend merchant agreements](milestone-3/frontend-merchant-agreements.md)
- [Authenticated frontend refactor](milestone-3/frontend-authenticated-refactor.md)

## Milestone 4 — Products and Inventory

- [Security audit](milestone-4/security-audit.md)
- [Milestone completion](milestone-4/completion.md)
- [Backend design](milestone-4/backend-design.md)
- [Product and inventory data model](milestone-4/product-inventory-data-model.md)
- [Product management API](milestone-4/product-api.md)
- [Stock-in and inventory adjustments](milestone-4/inventory-operations-api.md)
- [Inventory views and movement history](milestone-4/inventory-views-api.md)
- [Backend completion](milestone-4/backend-completion.md)
- [Frontend foundation](milestone-4/frontend-foundation.md)
- [Frontend product management](milestone-4/frontend-product-management.md)
- [Frontend inventory management](milestone-4/frontend-inventory-management.md)
- [Frontend movement history](milestone-4/frontend-movement-history.md)

## Milestone 5 — Online POS

- [Security audit](milestone-5/security-audit.md)
- [Backend completion audit](milestone-5/backend-completion-audit.md)
- [Sales and payment data model](milestone-5/sales-payment-data-model.md)
- [POS product lookup API](milestone-5/pos-product-lookup-api.md)
- [Online checkout API](milestone-5/online-checkout-api.md)
- [Sales history API](milestone-5/sales-history-api.md)
- [POS frontend foundation](milestone-5/pos-frontend-foundation.md)
- [POS frontend checkout](milestone-5/pos-frontend-checkout.md)
- [POS receipts](milestone-5/pos-receipts.md)
- [POS sales history](milestone-5/pos-sales-history.md)
- [Milestone completion audit](milestone-5/completion-audit.md)

## Milestone 6 — Merchant Finance

- [Backend design](milestone-6/backend-design.md)
- [Merchant finance data model](milestone-6/merchant-finance-data-model.md)
- [Settlement generation](milestone-6/settlement-generation.md)
- [Settlement read and generation API](milestone-6/settlement-read-generation-api.md)

## Documentation convention

Each implementation part should document, when applicable:

- scope and explicit exclusions
- architecture and important design decisions
- setup and configuration
- modules, database schema, and API changes
- business and security rules
- validation performed
- assumptions, limitations, and known issues

Documentation must be updated as part of the same task that changes the corresponding behavior.
