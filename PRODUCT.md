# Product

## Platform

web

## Users

The primary users for the initial release are concept-store owners, managers,
and cashiers who manage store operations.

Platform superadministration is part of the broader product model but is not a
primary initial-release experience.

## Product Purpose

The product is a multi-tenant SaaS Concept Store Management System. It replaces fragmented spreadsheets, paper records, messaging, and manual calculations with one operational system for concept-store businesses and their merchants.

Only the multi-tenant foundation is currently implemented. Merchant Profiles
has a proposed current plan, but implementation has not yet been approved.

## Positioning

This is one connected system with experiences and data access separated by
authorization. Product direction outside the current approved implementation
plan must not be treated as active scope.

## Operating Context

The product is intended initially for concept stores in the Philippines and uses English throughout the application.

Concept stores may operate multiple physical branches. Their workflows involve
store owners, managers, cashiers, and independent merchants.

## Capabilities and Constraints

- Only Milestone 1 is currently implemented: authentication, account settings,
  organizations, branches, memberships/RBAC, and organization invitations.
- Merchant Profiles is proposed as the next milestone; agents must wait for
  explicit user approval before implementing it.
- The application is a multi-tenant modular monolith developed milestone by milestone.
- An organization represents one subscribed concept-store business and may have multiple branches.
- Data belonging to one organization must never be accessible by another organization.
- Roles include `PLATFORM_SUPERADMIN`, `OWNER`, `MANAGER`, `CASHIER`, and `MERCHANT`.
- Role-specific pages and operations must remain separated by backend-authoritative authentication, membership, tenant, and role checks.
- Every new milestone must be planned and explicitly approved before implementation.
- Advanced features and infrastructure must not be introduced before their assigned milestone.
- Product-specific accessibility requirements remain an open decision.

## Brand Commitments

The product name is Concept Store Management System.

The approved brand direction is maintained in
`docs/architecture/frontend-architecture.md`. Future frontend work must preserve
that binding reference and prioritize clear, consistent, usable, fast,
professional B2B SaaS experiences.

## Evidence on Hand

- Current scope controls and engineering rules are documented in `AGENTS.md`.
- The approved brand commitments are documented in
  `docs/architecture/frontend-architecture.md`.
- The completed foundation summary is maintained under `docs/milestones/`.
- The repository currently contains working tenant operations for authentication,
  accounts, organizations, branches, memberships, and invitations only.
- No customer testimonials, usage benchmarks, case studies, press coverage, or commercial proof have been provided. Future interfaces must not fabricate them.

## Product Principles

1. Protect tenant isolation and authorization before convenience.
2. Treat only the current approved plan as implementation scope.
3. Expose only what each actor is authorized to access.
4. Deliver the smallest complete milestone without silently expanding scope.
