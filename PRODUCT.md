# Product

## Platform

web

## Users

The primary users for the initial release are:

- concept-store owners, who manage their store organization and its operations
- merchants, who need access to information and workflows belonging to their own business inside the concept store

Managers and cashiers are also supported through dedicated, authorization-appropriate application pages. Platform superadministration is part of the broader product model but is not a primary initial-release experience.

## Product Purpose

The product is a multi-tenant SaaS Concept Store Management System. It replaces fragmented spreadsheets, paper records, messaging, and manual calculations with one operational system for concept-store businesses and their merchants.

Success means that a concept store can manage the workflow from merchant participation through physical space, products, inventory, customer sales, merchant sales attribution, commercial deductions, settlement, and payout without relying on disconnected manual records.

## Positioning

This is one connected system with experiences and data access separated by authorization. It is not merely a generic POS: its distinguishing mechanism connects merchant-owned activity inside a concept store to the store's rent, commission, settlement, and payout workflows while preserving each organization's tenant boundary and each actor's permitted view.

## Operating Context

The product is intended initially for concept stores in the Philippines and uses English throughout the application.

Concept stores may operate multiple physical branches. Their workflows involve store owners, managers, cashiers, and independent merchants. Customer payments are received by the concept store, while individual sale items must remain attributable to their respective merchants for later financial calculation and settlement.

The browser-based POS must eventually continue operating during temporary internet outages, with PostgreSQL remaining the cloud source of truth when transactions synchronize.

## Capabilities and Constraints

- The application is a multi-tenant modular monolith developed milestone by milestone.
- An organization represents one subscribed concept-store business and may have multiple branches.
- Data belonging to one organization must never be accessible by another organization.
- Roles include `PLATFORM_SUPERADMIN`, `OWNER`, `MANAGER`, `CASHIER`, and `MERCHANT`.
- Role-specific pages and operations must remain separated by backend-authoritative authentication, membership, tenant, and role checks.
- Merchants may operate across multiple branches and may occupy multiple physical spaces.
- The concept store receives the full customer payment, but merchant-owned gross sales and store-earned revenue must remain distinct.
- Financial calculations must be precise, deterministic, auditable, and server-authoritative.
- The cloud PostgreSQL database remains authoritative when offline POS functionality is introduced.
- Milestones 1–7 are implemented. Milestone 8 offline POS remains the next
  roadmap boundary unless priorities are explicitly changed.
- Advanced features and infrastructure must not be introduced before their assigned milestone.
- Product-specific accessibility requirements remain an open decision.

## Brand Commitments

The product name is Concept Store Management System.

The approved brand direction is maintained in
`docs/architecture/frontend-architecture.md`. Future frontend work must preserve
that binding reference and prioritize clear, consistent, usable, fast,
professional B2B SaaS experiences.

## Evidence on Hand

- The milestone roadmap and confirmed domain rules are documented in `AGENTS.md`.
- The approved brand commitments are documented in
  `docs/architecture/frontend-architecture.md`.
- Completed milestone summaries are maintained under `docs/milestones/`.
- The repository contains working tenant operations from authentication through
  merchant reporting and payouts. Current behavior is documented under
  `docs/architecture/` and `docs/workflows/`.
- No customer testimonials, usage benchmarks, case studies, press coverage, or commercial proof have been provided. Future interfaces must not fabricate them.

## Product Principles

1. Protect tenant isolation and authorization before convenience.
2. Connect the full merchant-to-settlement workflow instead of behaving like a generic POS.
3. Keep owner and merchant work clear while exposing only what each actor is authorized to access.
4. Preserve financial and inventory history so real businesses can explain every important value.
5. Deliver the smallest complete milestone without silently expanding scope.
