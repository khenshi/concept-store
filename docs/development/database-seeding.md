# Development database seeding

The backend includes a demo dataset for local development and UI verification.
The seed creates one organization with two branches, four demo users, three
merchants, spaces and assignments, active agreements, products and inventory
movements, sales, a refund, receivables, and draft/approved/paid settlement
examples.

From `backend/`, run:

```bash
npm run prisma:reset:demo
```

This command builds the backend, truncates every application table, preserves
`_prisma_migrations`, and inserts the demo dataset. `npm run prisma:seed:demo`
is an alias for the same reset-and-seed operation so Prisma's configured seed
command is consistent with the documented workflow.

The command is restricted to `development` and `test` environments. A
production run requires the explicit `SEED_DEMO_DATA=1` override and should
only be considered against an intentionally disposable database. Always use a
dedicated local or test database because the reset is destructive.

All demo users use the password `DemoPassword123!`:

- `owner.demo@example.com`
- `manager.demo@example.com`
- `cashier.demo@example.com`
- `merchant.demo@example.com`

The seed uses fixed IDs and relative dates so repeated resets are predictable
while sales and settlement periods remain recent enough for the dashboards.
