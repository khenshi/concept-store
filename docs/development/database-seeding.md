# Development Database Seeding

The foundation seed is destructive and is intended only for disposable local or
test databases. It truncates application tables, then creates one organization,
two branches, OWNER/MANAGER/CASHIER/MERCHANT members, and one pending invitation.

From `backend/`, run:

```bash
npm run prisma:reset:demo
```

All demo members use `DemoPassword123!`. The command prints the pending
invitation token after seeding. The seed refuses non-development/test execution
unless `SEED_DEMO_DATA=1` is explicitly set.

The repository now contains a rewritten foundation-only migration baseline.
Never deploy it over a shared or production database created from the former
migration chain.
