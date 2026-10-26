# Development Database Seeding

The foundation seed is destructive and is intended only for disposable local or
explicitly confirmed development databases. It truncates application tables, then creates one organization,
two branches, OWNER/MANAGER/CASHIER/MERCHANT members, and one pending invitation.
It also creates five merchants (including lifecycle examples and Luntian Studio),
four products including an inactive product, and five branch placements. The vase
has independent Makati/BGC PHP prices (`850.00`/`925.50`) and final balances (`9`/`7`).
Makati tray stock is `5` at `450.00` after one returned unit is restocked;
Luntian pouch stock is `4` at `250.00`.
The inactive placement remains at zero. Receipts, a correction, and sale deductions
insert attributed movement history atomically with balance changes; no transfers occur.

Three completed persistence examples include a Makati cash sale (`850.00`, tender
`1000.00`, change `150.00`), a mixed Amihan/Luntian Makati GCash sale (`950.00`),
and a BGC card sale (`925.50`). A partial cash refund (`450.00`) for the Makati
GCash sale restocks one tray unit and creates a RETURN movement. Manual references
are demo-only and unverified.
The cashier creates Makati examples; the owner creates BGC's example without
granting the cashier BGC access. Snapshots and canonical commands are included.
These examples do not call the application checkout API. Scoped sales-read APIs
show the cashier's Makati sales, managers' assigned-branch sales and the linked
merchant's Amihan items/subtotals only, including its historical BGC card sale.
The POS and Sales screens expose these same scoped examples: staff open branch
history/receipt details, while the linked merchant's Sales entry discovers historical
Makati/BGC branches and shows Amihan items/subtotals without other-merchant,
cashier or payment information. Only staff receive full internal receipt printing.

Access examples assign the manager and cashier to Makati, link the
merchant member to Amihan Home Studio, and attach a BGC grant to the pending
cashier invitation. Owners have no explicit assignment rows and can access both
branches. The manager/cashier cannot access BGC unless explicitly assigned.
The linked merchant reads only Amihan products and stock, including its selling
branches; merchant branch reads omit addresses and history omits actor IDs.
Accepting the pending invitation applies its BGC assignment atomically.
Other existing nonowners are not automatically backfilled with branch access.

From `backend/`, run:

```bash
NODE_ENV=development \
DEMO_DATABASE_URL=postgresql://demo:demo@127.0.0.1:55439/concept_store_demo \
SEED_DEMO_DATABASE_NAME=concept_store_demo \
SEED_DEMO_CONFIRM=I_UNDERSTAND_DISPOSABLE_DEMO_RESET \
npm run prisma:reset:demo
```

All demo members use `DemoPassword123!` and seeded accounts are verified so the
development workspace can be tested without a mail provider. The command prints
the pending invitation token after seeding. The seed requires an explicit
`DEMO_DATABASE_URL`, exact database-name confirmation, the reset flag and the
confirmation value above. Loopback targets are accepted with the local
confirmation alone. A remote development target additionally requires
`SEED_DEMO_ALLOW_REMOTE_RESET=I_UNDERSTAND_REMOTE_DEMO_RESET` and an exact
`SEED_DEMO_REMOTE_HOST` match. It refuses production execution, missing Prisma
migration history, unresolved/failed migrations and stale migration history. A
rolled-back attempt that was explicitly resolved and followed by a later
successful attempt for the same migration is accepted.

The command is destructive: it truncates only the verified public schema of the
selected target. Remote reset is permitted only for an explicitly designated
development database and must never be used for a shared, pilot or production
database. The command does not create databases, verify a hosting provider, or
substitute for a backup/restore drill.

The repository now contains a rewritten foundation-only migration baseline.
Never deploy it over a shared or production database created from the former
migration chain.
