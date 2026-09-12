# Backend verification

Run `npm test -- --runInBand` for unit tests and `npm run test:e2e -- --runInBand`
for HTTP request/guard tests. HTTP tests bind temporary local server ports.

## PostgreSQL integration tests

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

Each run creates a random `inventory_test_<uuid>` schema, applies repository SQL
migrations there, uses that schema for Prisma/pg connections, and drops only that
schema after verification. Baseline public-schema creation is omitted to keep
setup isolated. No existing schema objects are modified. An interrupted process
may leave its test schema behind; discarding the disposable container removes it.

The command enables Node's experimental VM modules for Prisma's dynamic imports
inside Jest. A VM-modules warning is expected.

Cleanup the example container with `docker stop concept-store-inventory-test`.
Its `--rm` flag removes the container and disposable data; no mounted volume is
used. Docker image cache is retained.
