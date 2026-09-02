# Concept Store SaaS — Performance & Scalability Audit

**Status:** Completed initial optimization pass on September 3, 2026

## Implementation report

### System and database

- The application keeps one NestJS-scoped Prisma service and reuses its
  PostgreSQL pool; it does not create a client per request.
- Runtime traffic uses the pooled `DATABASE_URL`, while Prisma CLI migrations
  use the direct `DIRECT_DATABASE_URL`. The direct credential can therefore be
  withheld from the long-running production API.
- Pool size, idle timeout, connection timeout, and query timeout are now
  explicit, validated environment settings. Defaults are intentionally modest
  for the current Neon-hosted modular monolith and can be tuned per deployment.
- Added tenant/time indexes for cross-branch sales, refunds, and payouts. These
  complement the existing branch-, merchant-, status-, and period-oriented
  indexes used by operational pages and reports.
- No Redis, queue, microservice, or second database connection was introduced.

Expected impact: bounded connection usage under concurrency, failed/slow
connections stop consuming request capacity indefinitely, and organization-wide
financial date-range scans avoid unnecessary table scans as history grows.

### POS and sales

- POS catalog and sales history were already bounded by validated pagination.
- Exact SKU/barcode quick-add remains a single indexed tenant/branch lookup.
- General catalog search now performs one search request instead of first
  issuing an exact lookup that commonly returned 404 and triggered a second
  request.
- Checkout now selects only the product, merchant, and inventory fields needed
  for server-authoritative validation and snapshots.
- Inventory deductions retain conditional per-line updates for concurrency
  safety, while their audit movements are inserted in one batch.

Expected impact: less query payload and fewer database round trips during the
highest-frequency cashier operations without weakening stock checks,
idempotency, tenant scope, or transaction atomicity.

### Products and inventory

- Inventory overview uses bounded offset pagination, while movement history
  uses stable cursor pagination with deterministic `createdAt`/ID ordering.
- Inventory reads use purpose-specific relation projections and all writes keep
  their serializable transaction and movement trail.
- Product management still returns the full filtered catalog because product
  and inventory forms currently share that result as their selector data.
  Changing it requires a paginated directory plus an asynchronous product
  selector contract; silently truncating the existing endpoint would be
  incorrect. This is the next scalability change once catalogs approach the
  low thousands per tenant.

### Settlements and receivables

- Settlement history and rent receivables were already paginated, and detail
  relations are loaded only on detail endpoints.
- A live-payables branch filter is now applied in the tenant-scoped merchant
  query before any financial calculations. Previously, every active merchant
  was calculated and nonmatching merchants were discarded afterward.
- Pending adjustments now select only fields used by the live response.
- Live payables are paginated at the merchant query before calculations begin;
  the API defaults to 20 merchants and caps requests at 50. Settlement history
  is also requested 20 rows at a time instead of 100.
- The Merchant Finance frontend fetches only the active tab. It no longer loads
  settlement history and live payables together or loads history filter options
  before the history tab is opened.
- Live payable calculations remain server-authoritative and decimal-safe.

Expected impact: branch-scoped finance views avoid expensive work for unrelated
merchants, request cost no longer grows without a bound as merchants are added,
and initial/refresh requests transfer and calculate only visible finance data.

### Merchants, agreements, spaces, and organization administration

- Queries are tenant-scoped and use focused includes/selects. Shared frontend
  organization data has an in-flight promise cache, preventing duplicate loads
  across components in the same workspace.
- Merchant directory and shared merchant selectors currently use the same full
  result contract. As with products, the safe future change is a paginated
  directory plus searchable lightweight selector endpoint, not an arbitrary
  server cap that hides active merchants.
- Branches, active agreements, memberships, invitations, and physical spaces
  are presently organization-bounded operational sets. No speculative caching
  or infrastructure was added.

### Dashboard and reporting

- Report detail endpoints are server-paginated with maximum page sizes.
- Totals use database aggregates/grouping rather than loading all source rows.
- Overview recent-activity lists are explicitly limited.
- New organization/time indexes support the unfiltered date-range paths.
- No material N+1 query was found in the reporting paths.

### Frontend caching and loading

- The current application does not use TanStack Query. Its organization
  workspace context reuses cached results and deduplicates concurrent requests
  for branches, merchants, and products.
- Mutations update their local/shared affected record instead of refreshing the
  whole application.
- Adding a query library solely for this audit would duplicate working cache
  behavior and was not justified.

### Background work, files, and monitoring

- No current interactive request performs exports, email delivery, file
  processing, or scheduled settlement generation, so a queue is not justified.
- The application currently has no large file/image persistence path; object
  storage should be introduced with the first real upload feature rather than
  preconfigured now.
- Endpoint latency, error rate, pool saturation, and slow-query monitoring
  remain deployment concerns. The current repository has no selected telemetry
  provider, so provider-specific instrumentation was not added. Production
  deployment should capture p50/p95/p99 latency, database connection usage, and
  slow queries before further caching or architectural changes.

## Verification

- Prisma schema formatting, generation, and migration deployment
- Backend lint, build, and full Jest suite
- Frontend lint, TypeScript check, production build, and full Vitest suite
- Focused sales, inventory, settlement, configuration, POS, and finance tests

All functional checks passed. The repository-wide frontend Prettier check still
reports the pre-existing, unrelated
`src/features/organizations/organization-navigation.spec.tsx`; this audit did
not rewrite that file.

## Audit checklist

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
7. Offline Synchronization
8. Remaining modules

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
