# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are concept-store owners, managers, cashiers, and independent
merchants. Owners and managers administer their organization and branches;
cashiers handle authorized point-of-sale work; merchants use the features
available for their own products and sales.

## Product Purpose

Kapwesto is a multi-tenant SaaS workspace for concept-store businesses and their
merchants. It brings organization and branch administration, product and stock
work, checkout, sales history, refunds, and sales reporting into one operational
system, reducing reliance on fragmented spreadsheets, paper records, messaging,
and manual calculations.

## Positioning

Kapwesto connects store operations while keeping each user's experience and data
access scoped to their organization, branch assignments, and role. The product
serves both store operators and independent merchants within that access model.

## Operating Context

The product is intended for concept stores in the Philippines and uses English
throughout the application. Stores may have multiple physical branches and work
with independent merchants as well as owners, managers, and cashiers.

## Capabilities and Constraints

- Current behavior is documented in `docs/modules/`: authentication and
  accounts, organizations, branches, memberships and invitations, merchant
  profiles, products, branch inventory, point of sale, sales, refunds, and
  sales reports.
- Feature details and role-specific limits are defined by the corresponding
  module documentation. Do not assume functionality beyond documented behavior.
- Organization membership is the tenant boundary. Branch-owned records also
  enforce branch access where applicable; authorization is checked by the
  backend.
- Organization roles are `OWNER`, `MANAGER`, `CASHIER`, and `MERCHANT`.
  `PLATFORM_SUPERADMIN` is a product-level role and is not an implemented
  organization experience.
- The system is a PostgreSQL-backed modular monolith. New modules and
  substantial changes require an explicitly approved plan; the current plan is
  maintained in `docs/plans/current.md`.

## Brand Commitments

The product name is Kapwesto. `DESIGN.md` is the approved brand and visual
reference; `AGENTS.md` documents global frontend architecture and engineering
constraints.

## Evidence on Hand

- Implemented behavior is described in `docs/modules/`, one module per file.
- The repository contains the application and its working module flows; the
  module documentation is the source for their exact contracts and limits.
- No customer testimonials, usage benchmarks, case studies, press coverage, or
  commercial proof have been provided. Future interfaces must not fabricate
  them.

## Product Principles

1. Protect tenant isolation and authorization before convenience.
2. Expose only the data and actions each actor is authorized to access.
3. Treat only documented behavior and explicitly approved plans as current
   product scope.
4. Deliver the smallest complete approved change without silently expanding
   scope.

## Accessibility & Inclusion

The interface must meet WCAG 2.2 AA. Support keyboard-only use, visible focus,
200% zoom, reduced motion, long content, and 320-pixel viewports. No
product-specific accommodation needs have been documented.
