# AGENT.md

## Project

You are helping build a **multi-tenant SaaS Concept Store Management System**.

The platform is sold to concept store owners on a subscription basis. Each
subscribed concept store operates as an organization and may have multiple
branches and staff members.

The system is being developed **incrementally, milestone by milestone**.

## Current Planning State

Only Milestone 1 is implemented. A proposed Merchant Profiles plan now exists
in `docs/plans/current.md`, but it is not approved for implementation. Agents
must wait for explicit user approval before changing application code. Archived
roadmaps and proposals are not active requirements.

---

# 1. Primary Rule

**Do not implement features, modules, database entities, abstractions, integrations, or infrastructure that have not been explicitly assigned in the current milestone.**

Do not try to anticipate and build the entire system.

When a task is assigned:

1. Understand the requested milestone.
2. Inspect the existing codebase first.
3. Identify how the requested work fits the current architecture.
4. Explain important design decisions when necessary.
5. Implement only what is required.
6. Preserve existing working behavior.
7. Update relevant documentation after implementation.
8. Do not silently expand scope.

If a future feature affects today's design, make the current design extensible where reasonable, but **do not implement the future feature yet**.

---

# 2. Product Goal

The system replaces concept-store workflows that are commonly handled manually through spreadsheets, paper records, messaging, and manual calculations.

Core problems to solve:

- manual merchant inventory tracking
- manual sales attribution per merchant
- no real-time inventory visibility for merchants
- no centralized store income calculations
- manual physical space assignments
- fragmented multi-branch operations
- inability to continue POS operations during temporary internet outages

Product workflows beyond the implemented foundation require a separately
approved current plan.

---

# 3. Core Business Model

## SaaS Platform

The application is multi-tenant.

```text
Platform
└── Organizations / Concept Stores
    ├── Branches
    ├── Users / Staff
    └── Approved organization-scoped modules
```

Each organization represents one subscribed concept-store business.

An organization may have multiple branches.

Data belonging to one organization must never be accessible by another organization.

---

# 4. Main Actors

Initial application roles:

- `PLATFORM_SUPERADMIN`
- `OWNER`
- `MANAGER`
- `CASHIER`
- `MERCHANT`

General responsibilities:

### Platform Superadmin
Manages the SaaS platform, organizations, subscriptions, plans, and platform-level administration.

### Owner
Has full operational control of their concept store.

### Manager
Handles store operations with fewer high-level account/billing permissions than the owner.

### Cashier
Primarily handles POS transactions and limited branch operations.

### Merchant
Remains a foundation organization role. Any merchant-specific access requires
an explicitly approved plan.

Do not implement advanced permission granularity until required by a milestone.

---

# 5. Multi-Tenancy Rules

Multi-tenancy is a critical system invariant.

Most business entities must belong to an organization through an `organizationId` or equivalent tenant identifier.

Branch-specific records should also reference `branchId` when appropriate.

Examples:

```text
Merchant.organizationId
Branch.organizationId
Product.organizationId
Space.organizationId
Sale.organizationId
```

Rules:

- Never trust an organization ID supplied by the client without authorization checks.
- Derive tenant access from the authenticated user's membership/context.
- Every tenant-scoped query must enforce organization isolation.
- Cross-organization access must be impossible even if a valid entity ID is guessed.
- Avoid duplicated tenant logic when a clean reusable authorization/scoping pattern exists.
- Do not introduce a separate database per tenant unless explicitly requested.

---

# 6. Branch Model

A concept store may have multiple branches.

```text
Organization
└── Branch
```

Do not introduce new branch-specific relationships without current milestone
authorization.

---

# 7. Merchant Domain

A merchant is an independent brand/business selling products inside the concept store.

Expected merchant status concepts may include:

```text
ACTIVE
INACTIVE
SUSPENDED
ENDED
```

Exact enums should only be introduced when needed.

---

# 21. Suggested Technology Direction

Current preferred architecture:

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend
- NestJS
- TypeScript

### Database
- PostgreSQL

### ORM
- Prisma

Do not introduce infrastructure simply because it is commonly used in SaaS systems.

---

# 22. API and Backend Design Principles

Prefer:

- clear module boundaries
- thin controllers
- business logic in services/domain-specific layers
- explicit DTO validation
- authorization close to business operations
- database constraints for important invariants
- transactions for multi-step consistency requirements
- predictable API responses
- descriptive error handling

Avoid:

- giant services
- duplicated authorization checks
- business logic inside controllers
- premature repository abstractions
- generic abstractions with only one implementation
- unnecessary event-driven architecture
- premature microservices
- hidden side effects
- storing derived values when they can safely be calculated

A modular monolith is preferred unless architecture requirements explicitly change.

---

# 23. Database Principles

When designing schemas:

1. Protect tenant isolation.
2. Preserve important historical records.
3. Use foreign keys and database constraints where practical.
4. Add indexes based on actual query patterns.
5. Avoid premature denormalization.
6. Use transactions when multiple writes must succeed or fail together.
7. Avoid storing images/blobs directly in PostgreSQL unless explicitly required.
8. Store monetary values using precise decimal/numeric types, never floating-point types.
9. Define deletion behavior deliberately.
10. Prefer soft-delete/status/history approaches only when the business actually requires historical retention.

Never remove important business history simply because a related record changes later.

---

# 24. Security Principles

Always consider:

- authentication
- authorization
- organization isolation
- object-level access restrictions
- input validation
- rate limiting when relevant
- secure password handling
- secure token/session handling
- auditability for important actions
- least privilege

Never trust IDs, roles, organization IDs, or other sensitive values supplied by
the frontend when the backend can derive or validate them.

---

# 26. Auditability

Actions such as role and permission changes may require audit history.

Do not implement a global audit system until required, but avoid designs that make auditability impossible later.

---

# 27. Current Non-Goals

Anything outside the explicitly approved current plan is a non-goal. Do not use
archived documents or general product expectations to add adjacent features,
infrastructure, entities, or abstractions.

---

# 28. Current Milestone Status

## Milestone 1 — SaaS / Multi-Tenant Foundation

Scope:

- authentication
- organizations
- branches
- organization membership
- initial RBAC
- tenant isolation
- store settings where required

Primary goal:

> Establish a secure multi-tenant foundation.

---

## Next planning priority — Merchant Profiles

The proposed scope is defined only in `docs/plans/current.md`. Do not implement
it without explicit user approval, and do not infer additional requirements
from archived work.

---

# 29. Workflow for Every New Milestone

Before implementation, follow this process.

## Step 1 — Inspect

Read:

- existing modules
- current schema
- relevant services/controllers
- authorization patterns
- tests
- project documentation

Do not assume architecture that is not present.

## Step 2 — Define Scope

State:

- what is being built
- what is explicitly not being built
- dependencies on existing modules

Do not expand scope without approval.

## Step 3 — Design

Before major implementation, determine:

- entities and relationships
- business rules
- important constraints
- API routes
- DTOs
- service responsibilities
- authorization requirements
- transaction boundaries
- important edge cases

Keep the design proportional to the milestone.

## Step 4 — Implement

Implement the smallest complete version of the assigned milestone.

Prefer simple, maintainable code over generalized frameworks.

## Step 5 — Validate

Run applicable:

- lint
- typecheck
- unit tests
- integration/e2e tests
- database validation/migration checks

Fix failures introduced by the milestone.

## Step 6 — Document

Update relevant project documentation with:

- implemented behavior
- new endpoints
- business rules
- schema changes
- major architectural decisions

Do not create excessive documentation for trivial changes.

---

# 30. Response Behavior for Coding Agents

When working interactively:

- Be concise.
- Explain important decisions, not obvious syntax.
- Point out meaningful risks or tradeoffs.
- Do not repeatedly restate the entire architecture.
- Do not ask questions that can be answered by inspecting the repository.
- If ambiguity does not block implementation, choose the simplest reasonable approach and state the assumption.
- If ambiguity materially changes business behavior or data integrity, ask before implementing that behavior.
- Do not rewrite unrelated code.
- Do not rename unrelated files.
- Do not perform large refactors unless required.
- Do not remove working functionality unless explicitly requested.

---

# 31. Definition of Done

A milestone/task is complete when:

- requested behavior is implemented
- tenant isolation is preserved
- authorization is enforced
- important business rules are enforced
- relevant edge cases are handled
- database changes are valid
- tests/checks pass where applicable
- no unrelated features were added
- documentation is updated when necessary

---

# 32. Core Engineering Philosophy

Use this priority order when making decisions:

```text
Correctness
   ↓
Security / Tenant Isolation
   ↓
Financial Integrity
   ↓
Data Consistency
   ↓
Maintainability
   ↓
Simplicity
   ↓
Performance
   ↓
Convenience
```

Performance matters, but do not sacrifice correctness or tenant isolation for premature optimization.

The system should be designed for real businesses while remaining understandable and maintainable by a small development team.

---

# 33. Final Agent Reminder

This project will evolve.

The roadmap is **context, not permission to implement future milestones**.

Always work from:

```text
Current repository state
        +
Current assigned milestone
        +
Business rules in this file
```

Do not work from:

```text
"What would a full SaaS product eventually need?"
```

When unsure, prefer the smallest design that correctly supports the current milestone without blocking known future requirements.

## Security

Build security into every milestone, not as a final step.

- Enforce authentication, RBAC, tenant isolation, and object-level authorization on the backend.
- Validate all inputs and enforce database integrity.
- Protect sensitive data, tokens, financial records, and organization boundaries.
- Use secure transactions and prevent unauthorized or duplicate operations where applicable.
- Add security tests for critical flows and cross-tenant access.
- Never trust frontend-provided roles, prices, totals, organization IDs, or other sensitive values without server-side verification.
- Apply security improvements without unnecessarily overengineering the current milestone.
