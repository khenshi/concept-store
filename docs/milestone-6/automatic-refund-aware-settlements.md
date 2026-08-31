# Automatic and Refund-Aware Settlements

## Revised workflow

```text
Sales → automatic tracking → period closes → draft generated
→ owner/manager preparation → owner approval and lock
→ payout recorded → paid
```

The revision preserves one organization-wide payable settlement per merchant. Branches are shown as contributing activity rather than creating separate obligations, so organization-level fixed rent is charged only once.

## Calculation

```text
gross sales - completed refunds = net sales
net sales - commission - fixed rent +/- adjustments = amount due
```

Commission is calculated per immutable agreement segment after refunds. Fixed rent continues to use the approved calendar-day proration rule. Fixed-rent-only, commission-only, and hybrid agreements use the same calculation engine.

Refunds are immutable partial-item records. Quantities cannot exceed the unrefunded sold quantity and amounts are derived proportionally from the original sale-item total. Refund recording does not automatically return inventory to sellable stock because restock-versus-damaged disposition is a separate operational decision.

## Automatic generation

An in-process daily coordinator discovers missing closed periods for active agreements and calls the existing serializable generator. A tenant-scoped generation key and settlement/source uniqueness provide idempotency. An owner can trigger the same catch-up through:

```text
POST /organizations/:organizationId/settlements/generate-missing
```

The primary frontend does not expose ordinary manual scheduled generation. It presents automatic status plus the owner-only catch-up action. The underlying scheduled create endpoint remains available as a backend recovery primitive, while visible manual creation is reserved for documented off-cycle drafts.

The initial implementation intentionally does not add Redis, a queue, or a separate worker. Multiple-process deployment should run only one scheduler instance until a database lease is introduced for that deployment topology.

## Off-cycle settlements

Owners and managers may create a documented exceptional draft through:

```text
POST /organizations/:organizationId/settlements/off-cycle
```

Off-cycle drafts use an explicit date range, require a reason, claim each source record at most once, and exclude fixed rent by default to prevent duplicate rent charges.

## Audit and locking

Append-only events record generation, recalculation, adjustment changes, review, return to draft, approval, and payout. Approved settlements retain immutable term, sale, refund, adjustment, calculation, actor, and timestamp history. Later refunds or corrections belong to a later draft and never rewrite approved history.

## Overview and detail

The settlement overview supports merchant, contributing branch, period, and status filters plus exact summary totals. It displays merchant, branch, period, net sales, deductions, amount due, status, and actions. Detail includes terms, attributed sales, included refunds, adjustments, payout, and audit history.
