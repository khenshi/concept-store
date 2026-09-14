# Backend verification

Run `npm test -- --runInBand` for unit tests and `npm run test:e2e -- --runInBand`
for HTTP request/guard tests. HTTP tests bind temporary local server ports.

## PostgreSQL integration tests

Refund persistence tests cover tenant/branch/original-sale-item/merchant/price
constraints, exact monetary capacity, manual methods, duplicate command/line keys,
zero/partial/full restock representation, exact positive RETURN linkage, rollback,
preserved source snapshots/actors and private inventory projections. An upgrade
fixture creates sales and RECEIPT/SALE movements before the refund migration and
verifies unchanged data afterward. That suite validates persistence only.

The separate refund-command suite exercises the real create/replay service:
partial/full/multiple returns, original-price exact arithmetic and 100-line maximum
capacity, manual methods, current roles/grants/deleted users, foreign source items,
canonical/conflicting replay, inactive original placements, zero restock and
whole-command stock-overflow rollback. Temporary schema-local triggers inject
Refund/RefundItem/RETURN-movement write failures and are removed in finally blocks.
Concurrent over-return, identical/conflicting commands and checkout/receipt/
adjustment races reconcile immutable ledger history with stock. Test-side explicit
unchanged-command retries model 409 recovery; the API never silently retries writes.
Refund history/detail checks additionally cover strict staff/merchant selections,
mixed own-only refunds/counts, all-page remaining quantities, empty/past-end pages,
tied-time ordering beyond 50 records, historical inactive/shared/relinked profiles,
fresh role/grant/user access and foreign IDs. A paused history count lets another
refund commit before remaining/page queries, proving one repeatable-read snapshot.
Read-only preservation and maximum-capacity own subtotal/quantity checks compare
saved history and stock. Refund forms and rendered report cards remain later parts.
Full backend regressions now pass 369 unit, 189 HTTP and 231 PostgreSQL tests across six
integration suites.

Reports tests validate staff/merchant database aggregation, fixed payment
reconciliation, distinct own transactions in mixed sales, exact high-capacity
amounts and integer quantities, UTC half-open boundaries, more than one history
page, current roles/grants/profile links, private projections, branch/tenant
isolation and historical totals after live edits. A paused report transaction
lets another checkout commit between summary/payment queries to verify a consistent
snapshot. Report reads must leave sales, balances and ledger history unchanged.
Refund-aware report tests use real refund commands and additionally check separate
actual refund methods, distinct own refunds in mixed lines, processing-date
recognition independent of original sale dates, refund-only negative net periods,
millisecond boundaries, more than 50 refunds, high-capacity own totals/units and
current links/access. Paused staff and merchant report reads let another refund
commit between aggregate queries, proving a consistent snapshot. Reads preserve
original sales, completed refunds, stock and movements.

The suite covers inventory integrity and branch/merchant access, including concurrent
assignment versus owner promotion/removal, relinking versus role changes, last-owner
preservation, simultaneous invitation acceptance, acceptance versus revocation,
and failed grant rollback. Failed grant injection uses a temporary trigger only
inside the run's random schema, removed in a finally block. Conflict retries in
tests model explicit client retries; the API returns 409 rather than hiding retries.

Sales persistence tests additionally cover scoped foreign keys, payment checks,
exact monetary capacity, unique receipt/request/item links, preserved snapshots,
restrictive deletion, transaction rollback and private inventory-history projections.
Checkout checks include complete rollback on sale/item/movement insertion failure,
maximum 100-line precise arithmetic, current access on replay, mixed ownership,
concurrent checkout/withdrawal and identical/conflicting request-ID races. Failure
injection triggers exist only in the suite's isolated schema and are removed in
finally blocks; no production trigger or infrastructure is added.
Sales-read tests verify current role/branch/actor scope, historical merchant
ownership, shared/relinked/unlinked profiles, exact reduced response keys,
own-only subtotals/counts, filtered pagination and half-open UTC date ranges.
Expanded races cover opposite multi-line carts, stock receiving, second-movement
rollback and lock-controlled concurrent price/lifecycle changes. A transaction
serialized before a lifecycle change may retain its old valid snapshots; every
subsequent new checkout must observe the inactive state and be denied.

Product opening-stock tests cover atomic Product/placement/RECEIPT insertion,
exact price and integer bounds, legacy product-only creation, private response
projections, fresh owner/tenant/branch/actor checks, canonical replay after later
edits, conflicting/concurrent commands without SKU/barcode, and request metadata
constraints. Temporary triggers inject actual failures at each of the three writes;
all records must roll back. Explicit retries model recovery, never automatic API writes.

`npm run test:integration` requires an explicit `TEST_DATABASE_URL` pointing to a
disposable PostgreSQL test database. It never falls back to application
`DATABASE_URL`, loads application environment files, resets a database, or runs
the demo seed. Use a test-only database/user, never production credentials.

For example, start a disposable local container:

```sh
docker run --detach --rm --name concept-store-inventory-test \
  --publish 127.0.0.1:55439:5432 \
  --env POSTGRES_PASSWORD=inventory-test-only \
  --env POSTGRES_DB=concept_store_test postgres:17-alpine
```

Once PostgreSQL is ready, from `backend/`:

```sh
TEST_DATABASE_URL=postgresql://postgres:inventory-test-only@127.0.0.1:55439/concept_store_test npm run test:integration
```

Each suite creates a random `inventory_test_<uuid>`, `sales_test_<uuid>` or
`opening_test_<uuid>`, `reports_test_<uuid>` or `refunds_test_<uuid>` schema, applies repository SQL
migrations there, uses that schema for Prisma/pg connections, and drops only that
schema after verification. Baseline public-schema creation is omitted to keep
setup isolated. No existing schema objects are modified. An interrupted process
may leave its test schema behind; discarding the disposable container removes it.

The command enables Node's experimental VM modules for Prisma's dynamic imports
inside Jest. A VM-modules warning is expected.

Cleanup the example container with `docker stop concept-store-inventory-test`.
Its `--rm` flag removes the container and its anonymous image-created data volume;
no host application-data directory or named persistent volume is attached.
Docker image cache is retained.

## POS and sales screen verification

From `frontend/`, run `npm run format:check`, `npm run typecheck`, `npm run lint`,
`npm test` and `npm run build`. Tests cover scoped role-specific sales contracts,
historical merchant branches, exact own subtotals, UTC filters/pagination, stale
read clearing, staff receipt/print-only retries and merchant private-data denial,
alongside cart/payment/unknown-command recovery. These do not require application
database reset or seeding. The user explicitly waived rendered responsive,
keyboard/dialog, zoom and print QA for POS/sales on September 13, 2026; native
dialog shims and mocked printing do not certify browser-rendered behavior.

## Reports screen verification

Reports frontend checks cover explicit identity-only branch choice, allowed sidebar/
mobile roles, inclusive Philippines dates independent of browser timezone, bounded
UTC conversion, debounce/blur/Apply validation, exact large strings, staff payment
reconciliation and separate merchant own-only/private-field rejection. Scoped
regressions cover late responses, changed periods/roles/users, revoked branches and
access refresh after profile relinking. Read retry never writes sales/stock/payments.
Changed-source formatting, lint/typecheck/build and all 567 frontend tests pass.
Final backend checks pass: format/lint/build, 329 unit tests, 133 HTTP tests and 146
isolated PostgreSQL tests. The Reports test container was stopped/auto-removed;
the application database was untouched. Rendered Reports responsive/dropdown/date/
keyboard/focus/200% zoom QA was explicitly waived on September 14, 2026, not
inherited from POS/Inventory waivers. Those browser checks were not performed.
