# Current Implementation Plan

**Status:** Approved, including the recommended defaults; Part 1 persistence
reviewed and committed as `a830c47`. Part 2 API implemented, awaiting review;
Parts 3–6 are not implemented.

# Item Returns and Manual Refunds MVP

## Direction and dependencies

Add partial/full item returns against an existing completed sale, with recorded
manual refunds and optional restocking. Keep the original sale and receipt
immutable. Depend on Sales, Branch Inventory, Reports, current membership/branch
authorization and the existing POS/history organization shell and DESIGN.md.
The completed Reports plan remains historical in
[its archive](archive/branch-sales-reporting-mvp-2026-09-14.md).

Continue delivery by parts: implement one approved part, stop for review, commit
only after approval, then proceed to the next part. The user approved this plan
and its defaults before Part 1 implementation.

## Approved defaults

1. Record the actual refund method: staff may choose CASH, manual GCASH or manual
   CARD, even when different from the original sale payment. Default the selection
   to the original method, but require explicit confirmation that money was refunded.
   Noncash requires a reference; cash has no reference/tender/change. All are manual
   records, not payment-provider operations or verification.
2. Restock only the original sold placement in the original branch. For each returned
   line, choose a whole-unit restock quantity from zero through the returned quantity;
   default to zero to avoid automatically reselling damaged goods. Never restock
   another branch or automatically create a placement. Restocking may restore
   historical inactive products/merchants without reactivating them or enabling sale.
3. Reports recognize refunds on the refund completion date, not the original sale
   date. Gross sales use sale completion dates; refunds use refund completion dates;
   net recorded sales equals gross minus refunds and may be negative for a period.
   Keep Philippines inclusive date inputs and half-open UTC filtering.

Other proposed MVP rules: no enforced return time limit; refund only selected whole
units at their original saved unit price, with no discretionary amount, fees,
deductions or price substitution. A completed refund requires at least one returned
item, even when none are restocked. No refund without an item return in this version.

## Roles and isolation

- OWNER creates/reads refunds in all tenant branches; MANAGER only assigned branches.
- CASHIER and MERCHANT cannot create refunds. Cashiers retain existing own-sale
  POS/history access, without new refund-management APIs or controls.
- MERCHANT reads only refunded items historically owned by the currently linked
  profile, including mixed sales and inactive records. Historical own-sale access
  remains authoritative; assignments never expose other merchants' returns.
- Recheck current non-deleted-user membership, role, branch grants and merchant
  link inside transactions. Missing/foreign/inaccessible sales, items, branches and
  refunds use indistinguishable not-found behavior. Guessed IDs must not widen access.
- Merchant selections/responses never include full refund/sale totals, payment
  method/reference, refund actor, other items/counts, contacts or private command data.
  Separate strict staff and merchant contracts, never a staff-shaped fallback.

## Persistence and command integrity

Add focused Refund and RefundItem records, not a generic payment/returns framework:

- Refund belongs to an organization, original branch and sale, retaining completion
  time, actor attribution, unique tenant refund code/request ID, reason, actual
  refund method/reference and exact total. A private normalized command supports
  comparison/replay and is never returned. Completed records have no edit/delete API.
- RefundItem references the original tenant/branch/sale item and placement, with
  returned quantity, restock quantity, original unit price and exact line amount.
  Use preserved sale item identity/ownership snapshots, not current prices/names.
- Composite foreign keys constrain tenant, branch, sale, item, placement and merchant
  relationships. Deliberate restrictive history references; actor deletion behavior
  matches existing sales history. Index actual sale-history, date and own-item reads.
- Returned quantities are positive integers; restock quantity is an integer within
  `0..returnedQuantity`. Across completed refunds, cumulative returned quantity
  cannot exceed the original sold quantity. Duplicate lines are rejected.
- Store precise Decimal money with existing line/whole-sale capacity; derive every
  refund amount server-side from the original unit price times returned quantity.
  Do not accept totals, arbitrary amounts, merchant IDs or replacement placements.
- Require reason, UUID v4 request ID and 1–100 distinct original sale-item lines.
  Strict nested DTO whitelisting and applicable payment-field validation remain.

Use SERIALIZABLE transactions and a consistent original-sale/placement lock order
to prevent concurrent over-return and lost stock updates. Refund/items, cumulative
checks, bounded stock increments and linked positive RETURN inventory movements
succeed or roll back together. Zero restocking creates no movement. A new movement
type and scoped refund-item link are private in existing inventory history contracts;
merchants retain own-stock scope and actor-free history. No original SALE movement
is changed. Stock must remain within `0..2147483647`; overflow rejects the entire
command, never silently reduces restock or partially records a refund.

Tenant request-ID uniqueness compares canonical sorted lines, quantities, reason,
method/reference, sale/branch and original actor. Identical retries return the
original completed refund without another refund/movement, after current access
checks. Different actor/content/branch reuse returns a safe 409 conflict. Replay
precedes remaining-quantity and live lifecycle checks. Serialization/deadlock
conflicts fully roll back and ask for explicit unchanged-ID retry; no hidden writes.

## API and read contracts

Proposed focused routes:

```text
POST /organizations/:organizationId/branches/:branchId/sales/:saleId/refunds
GET  /organizations/:organizationId/branches/:branchId/sales/:saleId/refunds
GET  /organizations/:organizationId/branches/:branchId/sales/:saleId/refunds/:refundId
```

Provide bounded, stable pagination for refund history; summary/remaining returnable
quantities must cover all completed refunds, not just the visible page. Staff reads
include saved refund amounts/payment confirmation metadata and returned/restocked
quantities. Merchant reads select only matching own items, exact own subtotal,
receipt/refund code/time and reduced branch identity. Unknown queries are rejected;
Swagger/OpenAPI must match runtime scope-discriminated shapes. Repeatable-read
snapshots keep counts, rows and remaining quantities consistent.

## Reports

Extend existing scoped report APIs, without cross-branch totals or new infrastructure:

- Preserve grossSales, transactionCount, unitsSold and the fixed original-sale
  payment breakdown; label existing payment rows explicitly as gross sale payments.
- Add refunded amount, distinct matching refund count, returned units and net
  recorded sales. Do not redefine original sale count or gross units as net counts.
- Staff receive separate refund-method amount/count rows reconciling to refunds.
  Actual refund method may differ from sale method; never net unlike method rows
  or call them available cash/provider reconciliation.
- Merchant receives only own refunded amount, distinct refunds containing own items,
  own returned units and own net recorded sales, without method/payment data.
- Aggregate sale/refund streams independently in PostgreSQL before combining;
  avoid multiplying sale totals or return lines through joins. All components and
  fresh authorization share one repeatable-read snapshot.
- Amounts/counts remain exact strings beyond single-sale/JavaScript limits. Gross
  and refunds are nonnegative; net uses canonical signed two-decimal strings,
  never negative zero. Empty results return explicit zeros. Historical branch
  choices remain period-independent and do not widen inventory access.

## Frontend

Use the existing authorized sale detail in POS Sales History to start a return;
no new sidebar or standalone returns directory. Owner/manager dialog lists saved
items, remaining returnable quantities, per-line return/restock inputs, immutable
unit prices, derived estimates, reason and actual manual refund method/reference.
Require final received/refunded-money confirmation before recording. Show clearly
that non-restocked units do not change inventory. No controls for cashier/merchant.

Validate each input after 300 ms, immediately on blur and on submit; backend remains
authoritative. Pending and uncertain responses freeze the submitted command/request
ID and block unsafe repeat actions/navigation/dismissal. Provide explicit Retry same
refund; no automatic new refund after a timeout. Confirmed success reloads current
remaining quantities/refund history/stock as needed; read failures never replay a
successful write. Concurrent over-return/stock conflicts require fresh review.

Display paginated refund history/details beside the immutable original sale.
Merchants see only own refund lines/subtotals in existing own-sale detail, with no
staff/payment/actor/print exposure. Extend Reports with clearly separated gross,
refund and net figures plus date-basis explanation. Strict schemas verify exact
amounts, signed net arithmetic, scope and reconciliation. Scope/access changes
clear stale records; obsolete reads cannot restore them. No persistent/offline drafts.

## Explicit exclusions

No exchanges, refund-only goodwill payments, arbitrary partial monetary refunds,
discounts/fees/taxes, original-sale edits/deletes, voiding/cancellation, enforced
return windows, approval queues, customer accounts, provider integrations, chargebacks,
cash drawer/shift reconciliation, fiscal credit notes, refund printing/exports,
merchant payouts/commissions, cross-branch restocking/transfers, stock destruction
ledger, analytics infrastructure or unrelated refactors. Preserve unrelated
inventory-api.ts, root package files and performance-audit edits. Never reset/seed/
migrate the application database for tests.

## Delivery by parts after approval

Part 1 delivery: Refund/RefundItem schema and migration, precise generated Decimal
types, tenant/branch/sale/source-item/merchant/price constraints and linked positive
RETURN movements matching exact restock quantities. Actor/history references are
restrictive, restock defaults to zero, and private refund links remain omitted
from existing inventory response types/selections. No refund APIs, cumulative
quantity service, replay logic, report changes or frontend workflows are included.
Prisma format/validate/generate and backend format/lint/build, 329 unit tests,
133 HTTP tests and 181 disposable PostgreSQL tests pass. The new 35-test suite
includes pre-migration history preservation, field/relationship/capacity checks,
rollback and private projections. One unchanged POS HTTP assertion initially
failed with 404 and passed in the subsequent full rerun; no POS code was changed.
Refund/Sales/Inventory/test docs are updated. Reviewed and committed as `a830c47`.

Part 2 delivery: staff-only create/refund replay API with fresh transaction-level
membership/non-deleted-user/role/branch checks, strict normalized command and explicit
manual refund confirmation. Original-price totals, cumulative quantity limits,
bounded original-placement restocking and linked positive RETURN ledger writes are
atomic. Replay compares original actor and canonical command before remaining/live
checks; serialization/deadlock recovery is read-only and otherwise asks for explicit
unchanged-ID retry. Responses/OpenAPI exclude private request/command/actor fields.
Minimal existing inventory-history compatibility accepts/labels RETURN without adding
a refund form or changing inventory mutation permissions. Refund/Sales/Inventory/
Reports/test docs distinguish implemented commands from later reads/report figures.
Backend format/lint/build, 354 unit, 169 HTTP and 200 disposable PostgreSQL tests
pass, including 25 new service, 36 HTTP and 19 real command tests. Frontend
format/lint/typecheck/build and 569 tests across 75 files verify RETURN compatibility.
Stop for review;
Part 2 is not committed. Parts 3–6 remain excluded from this delivery.

1. Schema/migration, precise refund types, tenant-safe relationships and RETURN
   movement constraints; isolated PostgreSQL persistence tests and module docs.
2. Create/refund replay API, fresh authorization, cumulative return checks and atomic
   stock/ledger behavior; unit/HTTP/concurrent PostgreSQL tests and OpenAPI/docs.
3. Staff/merchant reduced refund history/detail and remaining-quantity reads;
   pagination, snapshot/privacy/isolation tests and docs.
4. Refund-aware staff/merchant report aggregation/contracts, processing-date basis,
   signed net arithmetic and reconciliation; real PostgreSQL report tests/docs.
5. Staff return/refund dialog and recovery/history UI, merchant own-return reads,
   report cards/contracts; frontend role/privacy/date/retry/component tests/docs.
6. Final regressions, migration verification only in disposable test schemas,
   rendered QA or a new refund-specific waiver, documentation and review. Commit
   only after approval, then archive the completed plan.

## Verification and completion

Test partial/full/multiple refunds, mixed ownership, exact capacity, cumulative
over-return, duplicate/conflicting replay, current role/grant/link changes, deleted
users, foreign IDs, inactive historical items, zero/partial restock, stock overflow,
failed writes at each stage and concurrent refunds/checkouts/receipts/adjustments.
Reconcile stock with immutable movements and refund totals with original prices;
verify read-only history/reports and unchanged original sales. Cover report dates
where the original sale is outside the period, negative net and consistent
snapshots during concurrent refunds. Merchant queries must never select private
staff/payment/other-owner data.

Run Prisma validation/generation, changed-file formatting, backend/frontend lint,
type checks/builds and applicable unit/HTTP/disposable PostgreSQL/frontend tests.
New rendered responsive, dialog/keyboard/focus, dropdown and 200% zoom QA requires
browser access or a new explicit waiver; existing Reports/POS/Inventory waivers
do not cover refund screens. Update implemented module docs after each part;
proposed behavior remains here. Archive only after final approval/commit/QA closure.
