# Development Database Seeding

The foundation seed is destructive and is intended only for disposable local or
test databases. It truncates application tables, then creates one organization,
two branches, OWNER/MANAGER/CASHIER/MERCHANT members, and one pending invitation.
It also creates five merchants (including lifecycle examples and Luntian Studio),
four products including an inactive product, and five branch placements. The vase
has independent Makati/BGC PHP prices (`850.00`/`925.50`) and final balances (`9`/`7`).
Makati tray stock is `4` at `450.00`; Luntian pouch stock is `4` at `250.00`.
The inactive placement remains at zero. Receipts, a correction, and sale deductions
insert attributed movement history atomically with balance changes; no transfers occur.

Three completed persistence examples include a Makati cash sale (`850.00`, tender
`1000.00`, change `150.00`), a mixed Amihan/Luntian Makati GCash sale (`950.00`),
and a BGC card sale (`925.50`). Manual references are demo-only and unverified.
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
npm run prisma:reset:demo
```

All demo members use `DemoPassword123!`. The command prints the pending
invitation token after seeding. The seed refuses non-development/test execution
unless `SEED_DEMO_DATA=1` is explicitly set.

The repository now contains a rewritten foundation-only migration baseline.
Never deploy it over a shared or production database created from the former
migration chain.
