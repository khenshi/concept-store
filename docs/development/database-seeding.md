# Development Database Seeding

The foundation seed is destructive and is intended only for disposable local or
test databases. It truncates application tables, then creates one organization,
two branches, OWNER/MANAGER/CASHIER/MERCHANT members, and one pending invitation.
It also creates four merchant lifecycle examples, three products (including an
inactive product), and four branch placements. The ceramic vase has independent
Makati/BGC PHP prices (`850.00`/`925.50`) and stock balances (`10`/`8`). Other
placements start at zero. Seeded receipts and a correction insert attributed
movement history atomically with balance changes; there are no transfer effects.

Access persistence examples assign the manager and cashier to Makati, link the
merchant member to Amihan Home Studio, and attach a BGC grant to the pending
cashier invitation. Owners have no explicit assignment rows. Access enforcement
and invitation grant acceptance are not yet implemented by the persistence part.

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
