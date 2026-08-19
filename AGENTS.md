# AGENT.md

## Project

You are helping build a **multi-tenant SaaS Concept Store Management System**.

The platform is sold to concept store owners on a subscription basis. Each subscribed concept store operates as an organization and may have multiple branches, merchants, staff members, physical retail spaces, products, inventory, sales, merchant agreements, settlements, and payouts.

The system is being developed **incrementally, milestone by milestone**.

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
- manual rent and commission calculations
- manual merchant settlements and payouts
- no real-time inventory visibility for merchants
- no centralized store income calculations
- manual physical space assignments
- fragmented multi-branch operations
- inability to continue POS operations during temporary internet outages

The product is **not merely a generic POS**.

Its core business workflow is:

```text
Merchant
   ↓
Space Assignment
   ↓
Products / Inventory
   ↓
Customer Sale
   ↓
Merchant Sales Attribution
   ↓
Rent + Commission
   ↓
Settlement
   ↓
Merchant Payout
```

---

# 3. Core Business Model

## SaaS Platform

The application is multi-tenant.

```text
Platform
└── Organizations / Concept Stores
    ├── Branches
    ├── Users / Staff
    ├── Merchants
    ├── Spaces
    ├── Products
    ├── Inventory
    ├── Sales
    └── Settlements
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
Can eventually access only their own products, inventory, sales, spaces, agreements, settlements, and payout information.

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

Branch-specific concepts may include:

- staff assignments
- physical spaces
- inventory
- POS devices
- sales

A merchant belongs to the organization and may operate across multiple branches.

Do not assume merchants belong to exactly one branch.

---

# 7. Merchant Domain

A merchant is an independent brand/business selling products inside the concept store.

A merchant may:

- have multiple products
- rent multiple physical spaces simultaneously
- operate in multiple branches
- have one or more agreements over time
- have sales attributed to them
- receive periodic settlements/payouts

Expected merchant status concepts may include:

```text
ACTIVE
INACTIVE
SUSPENDED
ENDED
```

Exact enums should only be introduced when needed.

---

# 8. Physical Space Domain

Concept stores divide physical retail/display space into exclusive spaces for merchants.

Examples:

- rack
- shelf
- cabinet
- booth
- table
- drawer
- custom space

A physical space belongs to a branch.

Each physical space can have **at most one active merchant assignment at a time**.

One merchant may have multiple active space assignments.

Use a separate assignment/history entity rather than permanently storing a merchant directly on a space.

Conceptual model:

```text
Space
- organizationId
- branchId
- code
- type
- status

SpaceAssignment
- merchantId
- spaceId
- startDate
- endDate
- agreedRent
- status
```

Assignment history must be preservable.

---

# 9. Merchant Agreements

A merchant's commercial arrangement with the concept store can vary.

Supported business models:

- fixed rent only
- commission only
- fixed rent + commission

Do not encode this as three separate merchant types.

The agreement should represent the business terms.

Conceptually:

```text
MerchantAgreement
- merchantId
- organizationId
- startDate
- endDate
- fixedRentAmount
- commissionRate
- settlementSchedule
- status
```

The exact schema should be designed during the relevant milestone.

Agreement history should be preserved instead of overwriting historical terms.

---

# 10. Settlement Schedule

The concept store owner controls how often merchants are paid.

Initial expected schedules may include:

- weekly
- semi-monthly
- monthly

Custom schedules may be supported later.

Do not build a complex scheduling engine until explicitly required.

---

# 11. Product Domain

Products belong to merchants.

Conceptually:

```text
Product
- organizationId
- merchantId
- name
- sku
- barcode
- sellingPrice
- status
```

Do not add advanced product variants, supplier management, warehouse inventory, or purchasing workflows unless explicitly assigned.

---

# 12. Inventory Model

Inventory represents products physically available/displayed in the concept store.

Inventory is branch-specific.

Initial model:

```text
Inventory
- productId
- branchId
- quantity
```

Maintain an inventory movement/audit trail instead of only mutating quantity.

Typical movement types may include:

```text
STOCK_IN
SALE
RETURN
DAMAGED
ADJUSTMENT
```

Conceptually:

```text
InventoryMovement
- productId
- branchId
- quantityChange
- type
- referenceId
- createdBy
- createdAt
```

Inventory movements should make it possible to explain why the current quantity exists.

Do not implement warehouse/display separation unless explicitly requested.

---

# 13. Sales / POS Domain

The concept store receives the customer's full payment.

A single transaction may contain products from multiple merchants.

Example:

```text
Merchant A product  ₱800
Merchant B product  ₱300
Merchant C product  ₱1,200
---------------------------
Customer pays       ₱2,300
```

The store receives the full `₱2,300`.

Internally the system must attribute revenue to each merchant.

Conceptual entities:

```text
Sale
- organizationId
- branchId
- cashierId
- subtotal
- discounts
- total
- createdAt

SaleItem
- saleId
- productId
- merchantId
- quantity
- unitPrice
- total

Payment
- saleId
- method
- amount
- referenceNumber
- confirmedBy
- paidAt
```

Keep enough sale-item historical data to prevent later product edits from changing historical transaction meaning.

---

# 14. Initial Payment Methods

Actual payment gateway integration is not required initially.

Expected manual payment methods:

```text
CASH
GCASH
BANK_TRANSFER
OTHER
```

For GCash or bank transfer:

1. Store displays its own QR/payment details.
2. Customer pays externally.
3. Cashier manually confirms the payment.
4. Optional reference number may be recorded.
5. Transaction is completed.

Do not integrate external payment providers unless explicitly assigned.

---

# 15. Merchant Settlements and Payouts

Merchant settlements calculate what the store owes a merchant for a given period.

Example:

```text
Gross merchant sales      ₱50,000
Commission                 -₱5,000
Fixed rent                 -₱2,000
Adjustments                  -₱500
----------------------------------
Net merchant payout       ₱42,500
```

Potential settlement lifecycle:

```text
DRAFT
REVIEWED
APPROVED
PAID
```

The settlement system must preserve historical calculations.

Do not recompute already-finalized historical settlements from mutable current agreement values.

Exact settlement logic must be defined during the finance milestone.

---

# 16. Store Revenue vs Gross Sales

Do not treat total customer sales as concept-store revenue.

Example:

```text
Gross customer sales    ₱500,000

Store revenue may be:
Merchant commissions     ₱35,000
Merchant rent            ₱50,000
Other store fees          ₱5,000
--------------------------------
Store revenue            ₱90,000
```

Merchant-owned sales and store-earned revenue must remain conceptually distinct.

---

# 17. Offline POS Requirement

The POS must continue accepting transactions during temporary loss of internet connectivity.

The **cloud PostgreSQL database remains the source of truth**.

The intended client is a browser-based application or PWA.

Conceptual architecture:

```text
PWA / Browser POS
       │
       ├── Online → Backend API → PostgreSQL
       │
       └── Offline → IndexedDB / local queue
                             │
                       Reconnect / Sync
                             │
                         Backend API
                             │
                         PostgreSQL
```

Offline capability should focus primarily on POS-critical functionality.

Do not attempt to make the full administration system offline unless explicitly requested.

---

# 18. Offline POS Scope

Expected offline capabilities:

- access cached sellable products
- barcode/product lookup
- build cart
- complete basic sale
- record manual payment
- persist unsynced transactions locally
- sync transactions after connection returns

Online-only features may include:

- advanced reporting
- merchant management
- agreements
- settlements
- subscription settings
- administrative configuration

Exact offline scope should be confirmed during the offline milestone.

---

# 19. Offline Sync Safety

Offline synchronization is a high-risk area.

When implemented:

- Every client-created sale must have a globally unique client transaction ID.
- Retrying sync must not create duplicate sales.
- Sync endpoints should be idempotent.
- The backend must remain authoritative.
- Failed syncs must not silently disappear.
- Pending/synced/error states should be distinguishable.
- Never assume local inventory is perfectly current after an outage.

Example failure:

```text
POS sends sale
Backend saves sale
Response is lost
POS retries
```

The retry must return/reuse the existing sale rather than create another one.

---

# 20. Offline Inventory Conflicts

Two offline POS devices may sell the same last cached item.

Example:

```text
Cloud quantity = 1

POS A cached quantity = 1
POS B cached quantity = 1

Both go offline.
Both sell the item.
```

When the offline milestone is implemented, prefer:

- allowing the sale to continue
- syncing both transactions
- flagging the inventory discrepancy for owner/manager reconciliation

Do not silently discard legitimate offline sales.

The exact conflict policy may be refined later.

---

# 21. Suggested Technology Direction

Current preferred architecture:

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- PWA capabilities
- IndexedDB for offline POS storage

### Backend
- NestJS
- TypeScript

### Database
- PostgreSQL

### ORM
- Prisma

### Object Storage
- S3-compatible object storage when file/image storage is introduced

### Future / Optional
- Redis only when a real caching, queue, or distributed-lock requirement appears

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
- branch access restrictions
- merchant self-access restrictions
- input validation
- rate limiting when relevant
- secure password handling
- secure token/session handling
- auditability for financially important actions
- least privilege

Never trust IDs, roles, organization IDs, branch IDs, prices, totals, commission calculations, or settlement amounts supplied by the frontend when the backend can derive or validate them.

Financial calculations must be server-authoritative.

---

# 25. Financial Integrity

Sales, commissions, rent, settlements, and payouts are financially sensitive.

When implementing these areas:

- prefer deterministic calculations
- use database transactions where consistency requires them
- preserve source records
- keep audit/history data
- avoid floating-point money arithmetic
- do not silently modify finalized settlements
- make adjustments explicit
- validate that records belong to the same organization
- carefully consider concurrency

Correctness is more important than cleverness.

---

# 26. Auditability

Actions that may eventually require audit history include:

- inventory adjustments
- sale cancellations
- refunds
- agreement changes
- settlement approval
- payout marking
- role/permission changes

Do not implement a global audit system until required, but avoid designs that make auditability impossible later.

---

# 27. Current Non-Goals

Unless explicitly assigned, do not implement:

- ecommerce storefront
- supplier management
- purchase orders
- warehouses
- loyalty programs
- native Android/iOS applications
- accounting integrations
- automatic merchant bank payouts
- payment gateway integration
- AI analytics
- forecasting
- advanced product variants
- custom report builders
- microservices
- event sourcing
- Kafka/message brokers
- multi-region infrastructure
- complex feature-flag systems

---

# 28. Milestone Roadmap

The roadmap provides direction, but **only the currently assigned milestone may be implemented**.

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

## Milestone 2 — Merchant Management

Scope:

- merchant CRUD
- merchant status
- merchant organization relationship
- basic merchant account/profile where required

Primary goal:

> Allow stores to centrally manage merchants.

---

## Milestone 3 — Spaces and Agreements

Scope:

- physical space types
- spaces
- branch ownership
- space assignments
- exclusive active assignment rule
- merchant agreements
- fixed rent
- commission
- hybrid rent + commission
- settlement schedule configuration

Primary goal:

> Represent how merchants occupy space and how the store earns from them.

---

## Milestone 4 — Products and Inventory

Scope:

- products
- merchant ownership
- SKU/barcode
- branch inventory
- stock-in
- adjustments
- inventory movements

Primary goal:

> Replace spreadsheet inventory tracking with auditable real-time inventory.

---

## Milestone 5 — Online POS

Scope:

- product lookup
- cart
- checkout
- manual payments
- sales
- sale items
- merchant attribution
- inventory deduction
- receipts where required

Primary goal:

> Complete reliable cloud-connected sales.

---

## Milestone 6 — Merchant Finance

Scope:

- settlement periods
- merchant gross sales
- commission calculation
- rent deductions
- adjustments
- net payout
- settlement lifecycle
- payout recording

Primary goal:

> Replace manual merchant remittance and payout calculations.

---

## Milestone 7 — Reporting and Dashboards

Scope:

- owner dashboard
- merchant dashboard
- sales reports
- inventory reporting
- merchant reports
- settlement/payout history
- store revenue vs gross sales

Primary goal:

> Give owners and merchants usable operational visibility.

---

## Milestone 8 — Offline POS

Scope:

- PWA/offline POS support
- IndexedDB/local persistence
- cached product catalog
- offline sales queue
- client-generated transaction IDs
- idempotent sync
- sync states
- conflict detection/reconciliation

Primary goal:

> Keep sales operating during temporary internet outages without compromising cloud authority.

---

## Milestone 9 — SaaS Billing

Scope:

- plans
- subscriptions
- trials
- usage/feature limits
- SaaS billing integration when selected

Primary goal:

> Commercialize the platform after core store operations are stable.

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
