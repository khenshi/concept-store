# Backend verification

Run `npm test -- --runInBand` for unit tests and `npm run test:e2e -- --runInBand`
for HTTP request/guard tests. HTTP tests bind temporary local server ports.

## PostgreSQL integration tests

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
`opening_test_<uuid>` schema, applies repository SQL
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
