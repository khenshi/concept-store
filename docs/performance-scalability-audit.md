# Concept Store SaaS — Performance & Scalability Audit Prompt

Audit and optimize the entire concept-store SaaS for **performance, efficiency, and scalability**, working **module by module**.

## Process

For each existing module:

1. Inspect the current implementation before changing anything.
2. Identify real bottlenecks.
3. Implement the smallest safe optimization.
4. Preserve existing behavior, business rules, RBAC, tenant isolation, financial accuracy, and API contracts unless a change is clearly necessary.
5. Test/verify the module before proceeding.
6. Do not prematurely introduce microservices or unnecessary infrastructure.

## Check and Optimize

### Database

- inefficient/duplicate queries
- N+1 queries
- fetching unnecessary fields/relations
- missing indexes
- composite indexes for common tenant/query patterns such as:
  - organization + branch
  - organization + merchant
  - organization + status
  - organization + createdAt
- expensive joins/aggregations
- large unpaginated queries
- cursor pagination for potentially large datasets
- proper transaction usage
- slow query patterns

Ensure all tenant data queries remain efficiently and securely scoped by organization.

### Connection Management

Inspect the database connection architecture and verify:

- connection pooling
- pool sizing
- connection reuse
- connection leaks
- connection/query timeouts
- unnecessary connection creation
- concurrency handling
- compatibility with the current database provider and deployment/serverless environment

Do not create separate DB connections per request.

### Backend/API

- return only required fields
- avoid oversized API payloads
- separate lightweight summary endpoints from detailed endpoints
- perform authoritative aggregations/calculations server-side
- avoid repeatedly loading thousands of records just to calculate totals
- remove redundant backend work
- identify blocking operations
- keep controllers/services/modules clean and efficient

Consider optimized endpoints such as dashboard, inventory, sales, merchant, and settlement summaries when justified.

### Frontend

- unnecessary API requests
- duplicate fetching
- unnecessary React rerenders
- whole-page refreshes after small mutations
- poor React Query/TanStack Query cache usage
- incorrect query invalidation
- missing `staleTime` where appropriate
- opportunities for targeted cache updates
- route/component code splitting
- lazy loading where beneficial
- loading unnecessary data for hidden/inactive UI

A mutation should refresh/update only affected resources, not unrelated modules.

### Pagination

Ensure potentially large datasets do not load everything at once, especially:

- products
- sales/transactions
- inventory movements
- merchants
- settlements
- payouts
- audit logs

Prefer cursor pagination where it provides meaningful scalability benefits.

### POS

Optimize POS for very fast cashier interaction.

Review:

- SKU/barcode lookup
- product search
- cart operations
- local product catalog caching
- branch inventory lookup
- merchant attribution
- unnecessary network calls

Barcode scanning and cart interaction should not depend on unnecessary server round trips.

### Caching

Identify data that can safely benefit from caching, such as:

- product catalogs
- branch configuration
- organization settings
- dashboard summaries
- merchant summaries

Use existing application/frontend caching first.

Do **not** introduce Redis simply because caching is possible. Recommend/add Redis only when there is a demonstrated server-side caching or infrastructure need.

### Background Processing

Identify work that should eventually move outside interactive requests, such as:

- settlement draft generation
- reports
- exports
- notifications
- receipt/email processing
- analytics aggregation
- large sync operations

Introduce/recommend queues such as BullMQ + Redis only when justified by current workload and architecture.

### Files

Ensure large files/images are not unnecessarily stored or transported through the main database.

Prefer object storage for:

- product images
- receipts/documents
- exports
- other uploaded files

### Monitoring

Make performance measurable.

Where appropriate, add or recommend monitoring for:

- endpoint response times
- slow DB queries
- DB query counts
- error rates
- database connection usage
- cache performance
- sync duration/failures
- background job failures

Optimize based on measured bottlenecks rather than assumptions.

## Architecture

Keep the application a **well-structured modular monolith** unless there is strong evidence that the current architecture cannot scale.

Do **not** migrate to microservices simply for scalability.

Prefer:

```text
Frontend
→ Modular Backend/API
→ PostgreSQL
→ Object Storage when needed
→ Redis/Queue only when justified
```

## Priority

Prioritize high-traffic/data-heavy modules:

1. POS / Sales
2. Products
3. Inventory
4. Settlements
5. Merchants
6. Dashboard / Reporting
7. Remaining modules

Also perform system-level checks such as database connection pooling and shared infrastructure separately rather than redundantly per module.

## Output After Each Module

Report briefly:

- problems found
- optimizations made
- database/index changes
- frontend/backend changes
- expected performance impact
- tests/verification performed
- remaining scalability concerns

Do not rewrite working code unnecessarily.

The goal is to make the existing system **fast now and capable of scaling to many organizations, branches, merchants, products, concurrent users, and millions of historical transactions without overengineering**.
