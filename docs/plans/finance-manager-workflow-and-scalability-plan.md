# Finance Manager Workflow, Partial Rent, and Scalability Plan

**Status:** Implemented, migrated, backfilled, reconciled, and verified  
**Created:** September 7, 2026  
**Implementation authorization:** Approved by the product owner in this session

## 1. Purpose

Improve the existing Finance workflow without replacing its current domain
boundaries:

- **Merchant payable** is the unsettled amount the store owes a merchant.
- **Rent receivable** is a monthly obligation the merchant owes the store.
- **Settlement** is an immutable closure snapshot of payable activity and any
  rent selected for application.
- **Payout** is the record that the approved settlement amount was paid.

This plan preserves the current settlement lifecycle and makes the smallest
practical changes needed to support manual partial rent application, partial
direct rent payments, safer retries and concurrency, a clearer manager
interface, and scalable live calculations.

The current implementation follows the approved decisions below. Live reads use
the reconciled projection, while settlement close retains the raw calculation
as the authoritative parity check and repair boundary.

### Implementation progress

- Added duration-based agreement fields and activation/end metadata.
- Added anchored anniversary rent-cycle fields and idempotent cycle generation.
- Added decimal-safe partial direct rent payments with request idempotency.
- Added per-receivable partial settlement applications and preview revisions.
- Added draft cancellation with source-link, rent-allocation, and adjustment
  release/void handling.
- Added duplicate-close request keys, active-source indexes, and a guarded
  deterministic development seed.
- Paginated merchants before live-row calculation, bounded calculation
  concurrency, and kept the organization-wide summary independent of row
  filters in the existing response contract.
- Existing reviewed rows are migrated back to actionable drafts while their
  historical review actor/timestamp and audit events remain preserved; the
  active UI/API lifecycle is now only draft → approved → paid.
- Updated the Finance and agreement interfaces to expose the new manager
  workflow and organization-wide summary labels.
- Added the transactionally maintained accrual projection, completed-sale and
  refund synchronization, settlement capture/cancellation rebuilds, report-first
  reconciliation and repair tooling, and projection-backed live Finance reads.
- Live settlement close recalculates raw sources, repairs projection drift, and
  rejects stale previews before creating a financial snapshot.
- The Finance hardening migration and deterministic demo seed were applied to
  the configured development database on September 8, 2026.
- Projection migrations and the development-data backfill were applied and
  reconciled to zero drift on September 9, 2026.

## 2. Confirmed Product Decisions

The following decisions are accepted for this plan:

1. Keep the current settlement flow and permissions:
   - Owner and manager can inspect payables and create a settlement draft.
   - The separate review state is removed for a faster workflow.
   - Only an owner can approve the prepared draft and record the payout; there
     is no separate review action.
2. Rent applied to a settlement is entered manually for each individual rent
   receivable.
3. Rent may consume the full merchant payable, resulting in a zero payout.
4. Direct rent payments may be partial.
5. Owner and manager may cancel any unapproved draft with a mandatory reason.
6. A zero payout still creates a `MerchantPayout` record with amount `0.00`.
7. A branch filter changes only the payable rows shown in the list.
8. Finance summary calculations below the list are organization-wide and do
   not become branch-scoped. Net sales, refunds, commission, adjustments,
   rent, and payable totals remain global across the organization.
9. Separately paid rent is recognized as store revenue in its rent source
   period, not its payment date.
10. Fixed rent is charged at the beginning of each agreement-month. Agreement
    months are anchored to the activation date; for example, an agreement
    activated on September 9 has its first period from September 9 through
    October 8 and its next period beginning October 9.
11. Missing rent periods must be generated safely rather than skipped.
12. Erroneous payable adjustments must be voided/reversed with an audit trail,
    not hard-deleted.
13. A refund should reverse commission using the commercial terms applicable
    to the original sale, not the agreement active on the refund date. The
    refund still affects the live payable when the refund occurs.
14. Activating an agreement starts it on the current Philippine business date.
    Scheduled future activation is deferred to a future feature.
15. Ending an agreement takes effect immediately on the current Philippine
    business date and cannot be backdated.
16. An active agreement must be ended explicitly before its replacement can be
    activated.
17. Rent is due immediately at the beginning of each anniversary period.
18. Month-end anniversary boundaries use the original activation day with
    temporary last-day clamping where necessary.
19. Agreement duration is limited to 1–60 months.
20. Managers may apply rent to a newer receivable while an older receivable
    remains unpaid; the UI sorts and recommends overdue/older rent first but
    does not force FIFO selection.
21. Branch and merchant filters affect only listed rows. Finance summary cards
    remain clearly labelled, organization-wide global totals.
22. Existing development financial data may be reset and replaced with a
    representative demo seed for the new agreement and Finance model.

### One implementation detail to confirm

The current safety guard does not activate a replacement on the same Philippine
business date that a prior agreement was ended. This prevents overlapping
commission terms and two agreement-month rent charges on one date. The
replacement can be activated on the next business date. If the intended policy
is same-day handover, choose whether the old agreement owns that day’s sales or
the replacement owns them; that requires an explicit timestamp/boundary rule.

## 3. Current Implementation Assessment

### Existing strengths to preserve

- Money is stored in PostgreSQL decimal columns and calculated with Prisma
  decimals.
- Controllers use authenticated organization context rather than trusting an
  organization ID from request data.
- Tenant-composite foreign keys protect merchant, settlement, receivable, and
  allocation relationships.
- Settlement creation and financial mutations use serializable transactions.
- A partial unique index permits only one unpaid settlement per merchant.
- Unique settlement source links prevent the same sale or refund item from
  being included in multiple active settlements.
- Settlement totals, agreement terms, linked sale/refund items, adjustments,
  allocations, payout, and lifecycle events preserve historical meaning.
- Rent receivables and their transactions are separate from merchant payable
  adjustments.
- Rent selected by a draft is reserved and is applied to the receivable ledger
  only when the payout is recorded.

### Correctness and workflow gaps

- Rent selection is currently a single all-or-nothing boolean.
- A preview can become stale before close; close recalculates but does not
  require the manager to acknowledge changed totals.
- A lost close or payout response is safely rejected on retry, but the retry
  does not return the already-created result.
- There is no safe draft cancellation/correction path. A bad draft can reserve
  rent, capture adjustments, and block later settlements indefinitely.
- The frontend hides the payout action when the approved payout is zero, even
  though the database permits a zero payout record.
- Unsettled payable adjustments can be deleted without retained void metadata.
- Direct rent payments must clear the full receivable and are blocked whenever
  any amount is reserved.
- Separately paid rent is not included in the current store-revenue report.
- The settlement field `fixedRentAmount` historically means rent applied to
  that payout. The current UI labels it “Rent deducted”; a physical column
  rename is deferred to a compatibility cleanup migration so existing
  settlement snapshots and reports are not needlessly rewritten.
- A refund is currently assigned to terms based on its refund date. That can
  reverse a different commission rate from the original sale.

### Performance gaps

- The live-payables endpoint loads every matching merchant, calculates every
  balance, builds global summary totals, and only then slices the requested
  page.
- Each merchant calculation performs multiple context queries and one or two
  complete unsettled sale/refund history scans. These run through an unbounded
  `Promise.all`.
- Settlement history loads all linked sale/refund rows merely to derive branch
  names.
- Settlement detail returns all source sales, refunds, adjustments,
  allocations, and audit events without pagination.
- The rent receivable list includes complete transaction histories for every
  row and calculates collected values in application memory.
- Finance reads repeatedly run rent creation and overdue-status writes.
- Returning to a Finance tab immediately reloads it; mutation invalidation is
  not consistently targeted across the related Finance views.

## 4. Target Financial Invariants

All authoritative calculations remain on the backend:

```text
net sales = gross sales - completed refunds

commission = commission on net activity using the original sale's terms

merchant payable = net sales - commission + active payable adjustments

settlement payout = merchant payable - selected rent applications

rent available for application
  = rent remaining balance - active draft reservations

rent remaining balance
  = original charge + receivable adjustments
    - direct payments - applied settlement deductions
```

Additional invariants:

- Each selected rent amount must be greater than zero.
- The selected amount for a receivable cannot exceed its available amount.
- Total selected rent cannot exceed the merchant payable.
- Total selected rent may equal the merchant payable.
- A settlement payout can be zero but can never be negative.
- The server rejects a close request if the accepted preview has become stale.
- A source sale/refund can belong to at most one non-cancelled settlement.
- An active rent reservation can belong to only one unpaid settlement for the
  merchant.
- A direct rent payment and payout may not consume the same reserved amount.
- A retry must not create a second settlement, payout, rent payment, audit
  event, or projection update.

## 5. Agreement Duration and Anniversary Rent Prerequisite

This work must precede the rent changes because the current receivable model is
calendar-month based.

### Proposed agreement model

Replace user-entered agreement start/end dates for new drafts with:

- `durationMonths`: positive whole number.
- Existing commercial terms: fixed monthly rent and/or commission.
- Existing settlement schedule: weekly, semi-monthly, or monthly.

Activation establishes the immutable dates and always starts today:

- `activatedAt`: exact audit timestamp.
- `startDate`: Philippine business date on which activation occurs.
- `scheduledEndDate`: derived from `startDate + durationMonths`, exclusive.
- Displayed inclusive end date: the day before `scheduledEndDate`.

Example:

```text
Duration:             3 months
Activated/start:      September 9
Rent period 1:        September 9 – October 8
Rent period 2:        October 9 – November 8
Rent period 3:        November 9 – December 8
Scheduled end:        December 9 exclusive
```

Active agreements remain immutable. They can be ended early with a reason and
actor. Ending an agreement during a rent period preserves the full receivable
for that already-started period and prevents future periods from being charged.
Sales and commission stop according to the effective early-end date.

The current automatic replacement behavior is removed: a new agreement must
not silently end an active agreement. The active agreement must first be ended
explicitly, after which a new draft can be activated.

### Anniversary calculation

All cycle boundaries must be calculated from the original activation date, not
by repeatedly adding a month to the prior clamped date. This avoids permanent
date drift.

Recommended missing-day behavior:

- Anchor to the activation day-of-month.
- If a month lacks that day, use its last day for that boundary only.
- Resume the original anchor when a later month contains it.

An agreement activated January 31 would therefore have boundaries on January
31, February 28/29, March 31, and April 30.

Rent is due immediately on each period's `periodStart`; therefore `dueDate`
equals `periodStart`. A newly generated unpaid charge is overdue only after that
business date has passed, so it remains `OPEN` during its first due date.

### Schema and migration

Add to `MerchantAgreement`:

- `durationMonths`.
- `activatedAt`.
- `scheduledEndDate` (exclusive, derived and persisted for audit/querying).
- `endedAt`, `endedById`, and `endReason` for explicit early termination.

Retain `startDate` and `endDate` for existing historical agreement and
settlement compatibility. For new agreements they become server-derived.

Migration strategy:

- Existing development agreements will be converted to the duration model;
  there will be no permanent legacy date-based calculation path.
- Development agreement, settlement, payout, rent-receivable, and related
  fixture data may be reset instead of inventing durations for old records.
- The reset must be guarded so it can run only in local development/test seed
  workflows. A deployable production migration must remain non-destructive and
  must never delete customer financial data.
- The demo seed recreates all Finance data under the new anniversary model.
- Never rewrite finalized settlement term snapshots or payout history.

### Agreement API and UI

- Create/update draft accepts `durationMonths`, rent, commission, and settlement
  schedule; it no longer accepts custom dates for new agreements.
- Activate endpoint derives and returns activation/start/end dates.
- End endpoint accepts a reason and the backend supplies the current Philippine
  business date. Backdating is rejected.
- Agreement form shows:
  - Duration in months.
  - “Starts when activated.”
  - A read-only example end date based on today.
  - Monthly rent and total scheduled rent for explanation only.
- Activation confirmation shows the exact start, cycle boundaries, scheduled
  end, and first rent charge before committing.

## 6. Rent Receivable Changes

### Anniversary-based receivable records

Replace calendar `sourcePeriod` semantics with explicit cycle data:

- `periodStart`.
- `periodEnd` (inclusive).
- `cycleNumber` starting at 1.
- `agreementId`.
- `originalAmount`, `remainingAmount`, and status.
- `dueDate`, equal to `periodStart`.

Uniqueness becomes `(organizationId, agreementId, cycleNumber)` rather than
`(organizationId, merchantId, calendar sourcePeriod)`.

Create the first receivable atomically with agreement activation. Generate a
new full rent receivable at the beginning of each later anniversary cycle only
while the agreement is active and the cycle begins before its scheduled or
early end.

### Reliable missing-period generation

Recommended approach for the confirmed “do not skip months” requirement:

1. Create cycle 1 during activation.
2. Run an idempotent daily anniversary generator in production.
3. Keep an idempotent catch-up check on Finance entry points and relevant
   agreement/rent mutations as a safety net.
4. Track the last generated cycle per agreement so reads do not rescan all
   historical agreements.
5. Enforce the cycle unique key so concurrent generator attempts are harmless.

This is preferable to relying only on page loads, and safer than creating every
future receivable at activation because an agreement may end early.

### Partial direct payments

Change the payment DTO to accept a positive decimal-string `amount`.

Within one serializable transaction:

- Lock/recheck the tenant-scoped receivable and active reservations.
- Compute the unreserved amount.
- Require payment amount to be no greater than the unreserved amount.
- Decrement remaining balance conditionally.
- Create one immutable payment transaction.
- Update status to open, partially paid, paid, or overdue.
- Accept a client request ID and return the prior transaction on retry.

If part of a receivable is reserved by a draft, a direct payment may still pay
the unreserved portion. It must not invalidate the reservation.

### Receivable adjustments

Retain documented signed adjustments, but return an explicit accounting
breakdown:

- Original charge.
- Net adjustments.
- Direct payments.
- Applied settlement deductions.
- Active reservations.
- Remaining and available balances.

This avoids presenting a balance reduction from an adjustment as if it were a
cash collection.

## 7. Settlement Workflow and Draft Cancellation

### Lifecycle

The simplified lifecycle is:

```text
DRAFT → APPROVED → PAID
   └────→ CANCELLED
```

Cancellation permissions:

- Owner and manager may cancel any `DRAFT` settlement because it has not yet
  crossed the owner approval boundary.
- `APPROVED` and `PAID` settlements cannot be cancelled. They require an
  explicit future correction process, outside this task.

The owner approval action is the review checkpoint. Its confirmation screen
must display the complete immutable snapshot, selected rent, and final payout.
There is no separate “mark reviewed” mutation or status.

Migration of the existing lifecycle:

- Convert existing `REVIEWED` rows back to `DRAFT` so the owner can approve or
  an owner/manager can cancel them.
- Preserve any existing review actor/timestamp and review audit event as
  historical context, but stop producing new review events.
- Remove the review endpoint, frontend action, status filter, and DTO/type
  value. The database enum retains the old value only as a PostgreSQL
  compatibility artifact; migrated application rows no longer use it.
- Update lifecycle database constraints and the one-open-settlement partial
  unique index to use `DRAFT` and `APPROVED`.

Cancellation requires a reason and is atomic:

- Mark the settlement cancelled with actor and timestamp.
- Mark source links released so they can be included in a later settlement.
- Mark receivable allocations released so they no longer reserve rent.
- Return captured payable adjustments to the live account without deleting or
  duplicating them.
- Append one cancellation audit event.

Cancelled snapshots and their original selections remain readable for audit.

### Source-link schema

Add `releasedAt`/cancellation metadata to settlement sale links, refund links,
receivable allocations, and normalized settlement-to-adjustment links. Replace
permanent global source uniqueness with partial unique indexes that apply only
to unreleased links. The normalized adjustment link allows a cancelled draft
to preserve what it captured while the same adjustment becomes eligible for a
later settlement; the current scalar `settlementId` cannot represent both facts
safely.

Live source queries must exclude sources with an unreleased settlement link.
Cancelled/released links remain historical but do not block a new closure.

### Adjustment voiding

Replace payable adjustment deletion with a void operation:

- `voidedAt`, `voidedById`, and mandatory `voidReason`.
- Live calculations include only non-voided entries.
- Settlement close captures only non-voided entries.
- Already captured entries cannot be voided through the live-payable endpoint.
- Original and void metadata remain visible in account activity.

## 8. Manual Per-Receivable Rent Application

### API contract

Preview and close accept selections such as:

```json
{
  "rentApplications": [
    {
      "receivableId": "uuid",
      "amount": "1500.00"
    },
    {
      "receivableId": "uuid",
      "amount": "500.00"
    }
  ]
}
```

The backend does not trust the supplied merchant, balance, totals, or payout.
It loads each receivable using organization and merchant scope, recalculates
availability, validates all amounts, and computes the final payout.

The manager may choose any available receivable and amount. Oldest-first is no
longer forced because selection is explicitly per receivable. The UI should
sort oldest first and recommend older/overdue balances, but the backend should
honor valid individual selections.

Preview returns:

- Each receivable's original, remaining, reserved, and available amount.
- Selected amount and remaining-after amount.
- Merchant payable.
- Total rent selected.
- Final payout.
- Opaque calculation revision/fingerprint.

Close requires:

- The same individual selections.
- The accepted preview revision.
- A client-generated closure request ID.

If any source or available balance changed, close returns `409` with a stable
error code and a new preview rather than silently changing the accepted payout.

### Zero payout

If selected rent equals the payable:

- Settlement `netPayout` is `0.00`.
- Owner still approves it.
- The payout action is labelled “Record zero payout and apply rent.”
- A zero-value `MerchantPayout` row is created.
- Selected rent allocations are applied in the same transaction.
- Settlement becomes `PAID` and no second payout can be created.

Keep the existing `MerchantSettlement.fixedRentAmount` storage column during
this rollout for compatibility, but expose it in the UI as “Rent deducted” and
keep it distinct from agreement fixed rent and receivable balances. A later
data-preserving cleanup may rename the column once all external consumers are
migrated.

## 9. Proposed Manager User Experience

### Current UI/UX compared with the proposed experience

The current Finance interface already follows the project's “Clear Store
Ledger” design direction: white bordered panels, slate typography, emerald
actions, compact tables, visible labels, and separate tabs for payables,
settlements, receivables, and activity. Those visual foundations should be
preserved.

| Area | Current UI/UX | Proposed UI/UX | Reason |
| --- | --- | --- | --- |
| Finance navigation | Four tabs on one page | Keep the same four tabs and add a small action queue above them | Preserves familiarity while exposing work waiting for the current role |
| Global totals | Summary cards appear below the payable table and are visually affected by the surrounding filters | Move global totals above filters and label them “Organization-wide totals” | Makes it unmistakable that branch and merchant filters affect rows only |
| Payable rows | Merchant, branches, period, deadline, amount due, and generic `View` action | Add explicit state, organization-wide scope note, outstanding rent, and a task-specific action | Managers can identify the next action without opening every row |
| Settlement creation | Payable detail plus one all-or-nothing rent checkbox | Three-step review with individual receivable amount fields and a sticky calculation summary | Supports partial rent safely and keeps the final payout visible |
| Preview behavior | Toggling rent triggers a preview request | User edits individual amounts, then receives a debounced or explicit server preview | Avoids noisy requests and makes server authority visible |
| Approval | Separate “Mark reviewed” and “Approve and lock” actions | Owner reviews the complete draft and uses one “Approve and lock” action | Removes a redundant lifecycle step without weakening owner control |
| Draft recovery | No cancellation/correction path | Owner/manager can cancel a draft with a required reason | Prevents an incorrect draft from blocking the merchant indefinitely |
| Zero payout | Payout form is hidden when payout is zero | Explicit “Record zero payout and apply rent” action | Allows the lifecycle to complete and produces the required payout record |
| Rent list | Full ledger data is loaded into list rows; `Manage` opens an inline form below the table | Lightweight rows; `Manage` opens a focused drawer on desktop and full-screen sheet/page on mobile | Keeps row context visible and gives partial payment enough room |
| Rent payment | Only full payment, using the current time automatically | Editable partial amount, payment date/time, method, reference, note, and confirmation summary | Matches real collection behavior and improves audit accuracy |
| Settlement detail | All sources render on one long page; rent allocations are not shown | Overview first, explicit rent applications, then paginated source sections | Improves auditability without loading or scanning an unbounded page |
| Errors | Mostly form/page-level messages | Field errors, stable conflict messages, stale-preview recovery, and preserved input | Makes financial corrections safer and faster |
| Mobile | Wide tables scroll horizontally | Summary and actions become ordered cards; large audit tables may still scroll | Keeps primary workflows usable without hiding financial context |

### UX principles for Finance

- **Show direction of money.** Use “Store owes merchant” for payables and
  “Merchant owes store” for rent receivables in supporting copy. Never combine
  them into one unlabeled balance.
- **Keep server authority visible.** Mark calculated values as “Calculated by
  the system” and require an updated server preview before closure.
- **Put the next action beside the state.** A manager should immediately see
  whether to open a payable, continue/cancel a draft, or wait for an owner.
- **Keep global and filtered scope explicit.** Filters sit with the table they
  affect; global totals sit in their own labelled section.
- **Use progressive disclosure.** List pages remain compact. Full source
  records, ledger transactions, and audit events appear in detail views.
- **Do not use color alone.** Every warning, status, and money direction has a
  text label in addition to emerald, amber, or red styling.
- **Preserve entered financial data on errors.** A failed preview, stale
  revision, or validation response must not clear rent/payment inputs.

### Information architecture and routes

Keep Finance under the existing organization settlement route so the change
does not introduce a second navigation concept:

```text
/settlements
├── Merchant Payables (default tab)
├── Settlement History
├── Rent Receivables
└── Merchant Activity

/settlements/payables/:merchantId
└── Live payable + settlement preparation

/settlements/:settlementId
└── Draft approval/cancellation or paid historical detail

/merchant-receivables/:receivableId
└── Optional dedicated ledger route for direct links and mobile use
```

Tab selection should be represented in the URL query, such as
`?view=receivables`, so refresh, browser navigation, copied links, and return
navigation preserve context. Table filters and pagination should also be URL
state where practical.

### Visual design specification

Follow `DESIGN.md`; do not create a separate Finance visual system.

- Page background: Cloud Slate (`#F8FAFC`).
- Panels: Clear White with one-pixel Hairline Slate borders, `0.75rem` radius,
  and no resting shadow.
- Primary action: Operational Emerald (`#059669`), Deep Emerald on hover.
- Supporting links: bold Deep Emerald with underline when rendered as text.
- Warning/overdue state: Signal Amber used only for border, icon/marker, and
  short status messaging—not as a decorative card background.
- Destructive cancellation/voiding: Alert Red text/border with explicit
  confirmation language.
- Typography: Inter; tabular numerals for all amounts; sentence case for action
  labels and status descriptions.
- Controls: minimum 44–46px target height, visible labels, restrained `0.6rem`
  radii, and existing emerald focus outline.
- Currency: show `₱`/PHP consistently, two decimal places, and right-align
  comparable table amounts.
- Negative values: use a leading minus sign in addition to the label; do not
  rely on red text to communicate subtraction.

### Desktop Finance landing layout

Use one wide authenticated workspace column, consistent with current pages:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Merchant finance                                      [Refresh]      │
│ Payables, rent, settlements, and payouts                             │
├──────────────────────────────────────────────────────────────────────┤
│ Needs attention                                                     │
│ [4 drafts awaiting approval] [2 payouts] [7 overdue rents]          │
├──────────────────────────────────────────────────────────────────────┤
│ Merchant Payables | Settlement History | Rent Receivables | Activity│
├──────────────────────────────────────────────────────────────────────┤
│ Organization-wide totals                                            │
│ [Net sales] [Refunds] [Commission] [Rent] [Merchant payable]        │
│ These totals do not change with the row filters below.               │
├──────────────────────────────────────────────────────────────────────┤
│ List filters: [Merchant ▾] [Show merchants in branch ▾] [State ▾]   │
│ Amounts in every merchant row include all branches.                  │
├──────────────────────────────────────────────────────────────────────┤
│ Merchant payable table                                              │
│ ...                                                                  │
│ [Previous]                                      1–20 of 84 [Next]   │
└──────────────────────────────────────────────────────────────────────┘
```

The global summary endpoint loads independently from the row list. A filter
change should show a table-level loading state without flashing or clearing the
global cards.

### Mobile Finance landing layout

- Keep tabs horizontally scrollable with visible text; do not hide them behind
  an unlabeled menu.
- Show “Needs attention” as a short vertical list.
- Show global totals in a two-column grid, collapsing to one column on narrow
  screens.
- Put filters in a collapsible “Filter payable rows” panel with an active-filter
  count.
- Render payable rows as semantic record cards in this order:
  merchant and state, amount due, period/deadline, outstanding rent, branches,
  then primary action.
- Keep history/audit tables horizontally scrollable when converting them to
  cards would obscure column relationships.

### Loading, empty, and failure states

- Global summary and row list receive separate skeletons and error boundaries.
- A summary failure must not hide an otherwise usable payable list.
- Refresh keeps existing amounts visible with an “Updating…” status instead of
  blanking the page.
- Empty filtered result: “No merchant payables match these row filters,” plus a
  `Clear filters` action.
- Empty organization result: explain that active merchants and agreements are
  needed; link to the merchant/agreement workflow for authorized roles.
- A stale preview uses an amber inline notice: “Financial activity changed
  after this preview. Review the updated amounts before creating the draft.”
- Concurrency conflicts retain entered amounts and focus the first affected
  receivable row.

### Role-specific interface

| State | Manager | Owner |
| --- | --- | --- |
| Live payable | View, adjust/void adjustment, prepare draft | Same |
| Draft settlement | View and cancel | View, cancel, approve and lock |
| Approved settlement | Read-only; sees “Awaiting owner payout” | Record payout |
| Paid settlement | Read-only audit view | Read-only audit view |
| Rent receivable | Record partial payment and adjustment | Same |

Do not render disabled owner-only primary buttons for managers. Show a concise
state explanation instead, while backend authorization remains authoritative.

### Finance landing page

Keep the current separate tabs:

1. Merchant Payables
2. Settlement History
3. Rent Receivables
4. Merchant Activity

Add a compact “Needs attention” strip above the active tab:

- Drafts awaiting owner approval.
- Approved settlements awaiting payout.
- Overdue rent receivables.

These are counts/links, not merged accounting balances.

The strip is role-aware: managers see drafts and overdue rent they can act on;
owners also see approved settlements awaiting payout. Each item links to its
filtered list rather than opening an arbitrary record.

### Merchant Payables list

The branch filter is explicitly labelled **“Show merchants in branch”**.

- It filters only the displayed merchant rows.
- Each merchant row continues to show the merchant's organization-wide payable.
- A notice states: “Amounts are organization-wide across all branches.”
- Summary cards remain organization-wide and do not change with the branch
  filter.
- Merchant filter may narrow rows, but global summary cards remain unchanged;
  if filtered-summary behavior is desired later it must use a separate label.

Suggested row actions/status:

- `View payable` for ready/overdue merchants.
- `Continue draft` for an open draft.
- `Awaiting owner approval` for draft settlements.
- `Record payout` for approved settlements when viewed by an owner.

### Payable detail and settlement creation

Use a three-step review panel on one page:

Desktop uses an approximately five-eighths/three-eighths layout. Steps 1 and 2
occupy the primary column. A sticky “Settlement summary” panel occupies the
supporting column and keeps payable, selected rent, and final payout visible.
On mobile the summary appears after the selected step and immediately before
the confirmation action, preserving task order.

```text
┌──────────────────────────────────────┬───────────────────────────────┐
│ Merchant / period / deadline         │ Settlement summary            │
│                                      │ Merchant payable   ₱8,000.00  │
│ 1. Review payable                    │ Rent selected     -₱3,500.00  │
│ 2. Apply rent by receivable           │ Final payout       ₱4,500.00  │
│ 3. Confirm                            │ Rent remaining     ₱6,500.00  │
│                                      │                               │
│ [Back] [Update preview]               │ [Create draft settlement]     │
└──────────────────────────────────────┴───────────────────────────────┘
```

#### Step 1 — Review merchant payable

- Gross sales.
- Refunds.
- Net sales.
- Commission.
- Active adjustments.
- Merchant payable before rent.
- Period, deadline, and organization-wide branch notice.

#### Step 2 — Apply rent

Show one row per available receivable, oldest/overdue first:

```text
Rent period           Outstanding   Reserved   Available   Apply now
Sep 9 – Oct 8          ₱5,000.00      ₱0.00    ₱5,000.00  [₱2,000.00]
Oct 9 – Nov 8          ₱5,000.00      ₱0.00    ₱5,000.00  [₱0.00]
```

- Inputs accept decimal amounts and provide “Use available” per row.
- Show remaining balance immediately for guidance.
- Display a running “Selected X of payable Y” progress line without treating
  the client value as authoritative.
- Disable creation while total entered rent exceeds the last server-confirmed
  payable, but always rely on backend validation.
- Server preview is requested after a short debounce or explicit “Update
  preview,” not on every keystroke.
- Server validation errors are attached to the relevant receivable row.

#### Step 3 — Confirm settlement

```text
Merchant payable       ₱2,000.00
Rent selected          -₱2,000.00
Final payout                ₱0.00
Rent still outstanding  ₱8,000.00
```

Confirmation displays the exact accepted preview revision. If it becomes stale,
the user returns to the updated review rather than creating a changed draft.

The final confirmation dialog names the merchant, cutoff, selected rent, and
payout. Its primary action says `Create draft settlement`; it must not imply
that money has already been paid.

### Settlement detail

- Keep calculation, source, adjustment, history, and payout sections separate.
- Add a visible “Rent applications” section with period, selected amount,
  applied/released status, and remaining balance at the time of display.
- Draft actions: owner/manager can cancel with a mandatory reason; owner can
  review and approve directly.
- Approved action: record payout, including the zero-payout path.
- Paginate source sales, refunds, and history instead of rendering an unbounded
  page.

Layout order:

1. Merchant, period, status, and next valid action.
2. Calculation equation cards.
3. Rent application table.
4. Agreement-term snapshots.
5. Paginated sales/refunds.
6. Adjustments and audit timeline.
7. Payout record or payout form.

For a draft, keep `Approve and lock` in a top action bar for owners and place
`Cancel draft` as a visually secondary red text action. Cancellation opens a
confirmation dialog with a required reason field and explains that sources and
rent reservations will return to the live payable.

For an approved zero payout, replace payment method fields with a concise
confirmation because no funds move. Record the zero payout with method `OTHER`
and the system note “No funds transferred; rent application consumed the full
merchant payable.” The database record and audit event remain mandatory.

### Rent Receivables

- List rows return lightweight summaries only.
- Add merchant, status, and period filters.
- “Manage” opens a side panel/detail route showing the full ledger.
- Record payment form includes amount, date, method, reference, and note.
- Default amount is available unreserved balance but can be reduced.
- Clearly distinguish cash collected, non-cash balance adjustments, active
  settlement reservations, and remaining balance.

Desktop layout for the manage drawer:

```text
┌───────────────────────────────────────────────┬──────────────────────────┐
│ Rent receivable list                         │ Rent for Sep 9 – Oct 8    │
│                                               │ Original       ₱5,000.00 │
│ Selected row remains highlighted              │ Paid           -₱1,500.00│
│                                               │ Reserved       -₱1,000.00│
│                                               │ Available       ₱2,500.00│
│                                               │                          │
│                                               │ [Payment] [Adjustment]   │
│                                               │ Amount [        500.00 ] │
│                                               │ Method [GCash ▾]         │
│                                               │ Date/time [...]          │
│                                               │ Reference [...]          │
│                                               │ Note [...]               │
│                                               │ [Record partial payment] │
└───────────────────────────────────────────────┴──────────────────────────┘
```

On mobile this becomes a full-screen sheet or dedicated route with a clear
back action. The form confirmation repeats payment amount, remaining balance,
source period, merchant, and method.

### Agreement creation and activation UX

The agreement prerequisite needs its own explicit workflow:

1. Manager/owner creates a draft with duration (1–60 months), fixed monthly
   rent and/or commission, and settlement schedule.
2. Form copy states “The agreement starts when activated.” No custom start/end
   date inputs are shown.
3. A read-only preview uses today only as an example and warns that final dates
   are calculated at activation.
4. Activation confirmation fetches a server preview showing:
   - Activation/start date.
   - First rent period and immediate due date.
   - All anniversary boundaries or at least first/last boundaries.
   - Scheduled agreement end.
   - First rent amount.
5. `Activate agreement` creates the first rent receivable atomically.
6. If another agreement is active, activation is blocked with a link/action to
   end the current agreement; it never silently replaces it.

Agreement list rows show duration, activated date, current anniversary period,
scheduled end, commercial terms, and status. Ending an active agreement uses a
confirmation dialog—not a custom date input—and explains that the current
period's full rent remains due while later cycles will not be created.

### Accessibility and interaction requirements

- Preserve semantic headings, tables, captions, row headers, labels, and
  `aria-current` on tabs.
- Announce refreshed preview totals and successful financial mutations through
  a polite status region.
- Use `role="alert"` for blocking validation and stale/conflict messages.
- Move focus to the first invalid rent amount or payment field.
- After a modal/drawer closes, return focus to the action that opened it.
- Confirmation dialogs trap focus, support Escape when not submitting, and
  identify destructive actions in both text and styling.
- Every input has a persistent label; placeholders are hints only.
- Amount inputs use decimal input mode, accept two decimal places, and include
  accessible help describing minimum and maximum allowed values.
- Tables remain keyboard navigable; pagination announces the displayed range.
- Respect reduced-motion preferences; no workflow depends on animation.

### UX acceptance criteria

- A manager can prepare a settlement with two different partial rent amounts
  without leaving the payable detail page.
- An owner can understand and approve the exact payable equation without
  opening raw source rows.
- A zero payout can be approved and completed without a hidden or disabled
  terminal action.
- A draft can be cancelled with a reason and the interface immediately shows
  the restored live payable and available rent.
- A partial direct rent payment shows its impact before confirmation and the
  updated remaining/available balance afterward.
- Branch or merchant row filters never change the labelled organization-wide
  summary cards.
- Desktop and mobile preserve the same task order and financial labels.
- Loading, validation, stale data, authorization, and empty states all provide
  a clear recovery action.

## 10. Immediate Query and API Optimization

The first implementation applies the low-risk pieces in the existing API:
merchant pagination occurs before live calculations, page calculations run in
bounded batches, and the response summary is computed from an unfiltered
organization-wide merchant set. The following items remain the next scale
phase rather than silently changing the current API contract.

Before introducing a new projection:

1. Apply merchant pagination before detailed live calculations.
2. Optionally separate endpoints once measured payload/query cost justifies it:
   - `GET /settlements/payables` for paged rows.
   - `GET /settlements/payables/summary` for global organization totals.
3. Until that split is justified, the existing response keeps the summary
   embedded but computes it from all active organization merchants; branch and
   merchant filters affect rows only.
4. Batch page calculations by merchant IDs rather than opening repeated
   per-merchant query groups.
5. Bound any unavoidable calculation concurrency.
6. Add a `SettlementBranch` snapshot/junction at close so history lists do not
   load all source rows to derive branch names.
7. Make settlement list responses summary-only.
8. Add cursor-paginated settlement sales, refunds, and audit endpoints.
9. Make rent receivable lists summary-only and add cursor-paginated transaction
   detail.
10. Remove recurring organization-wide write work from ordinary GET requests.

Potential indexes must be confirmed with production-like `EXPLAIN ANALYZE`, but
likely candidates include:

- Partial live payable-adjustment index by organization/merchant/time where the
  entry is unsettled and not voided.
- Partial active rent-allocation index by organization/merchant/receivable.
- Partial open rent-receivable index by organization/merchant/period.
- Settlement history indexes that include the deterministic date/created/ID
  ordering columns.
- Organization/status/completed-time indexes for sale and refund source scans
  if query plans show the existing indexes are insufficient.

Do not add Redis or a second datastore for these changes.

## 11. Scalable Live Finance Projection

After the workflow and accounting rules are stable, introduce a write-through
`MerchantFinanceAccrual` projection. It accelerates live reads but does not
replace immutable source records.

Bucket it by the dimensions required to preserve commission terms:

- Organization.
- Merchant.
- Original sale agreement/term bucket.
- Settlement schedule period.

Store decimal unsettled totals and a revision, including gross sale and refund
amounts. Update the projection atomically during:

- Checkout.
- Eligible pre-settlement sale void.
- Refund creation, using the original sale's agreement/commission basis.
- Settlement close, when linked sources leave the live balance.
- Draft cancellation, when released sources return to the live balance.

Payable adjustments remain in their own audited table. Rent remains in the
receivable ledger. Settlement snapshots remain the authoritative historical
closure.

Deployment steps:

1. Create projection schema and constraints.
2. Backfill it from active, unreleased source records.
3. Run old and projected calculations in comparison mode.
4. Reconcile mismatches before switching reads.
5. Keep a reconciliation command that compares projection totals with source
   records and reports drift.
6. Switch live list and global summary reads to the projection.
7. Continue verifying raw sources inside settlement close.

No queue is required initially; projection updates participate in the existing
financial transaction and roll back with it.

## 12. Reporting and Frontend Data Fetching

### Reporting

- Recognize direct rent payments in their receivable source period.
- Recognize settlement-applied rent once from applied allocations; never count
  both the receivable transaction and settlement snapshot as two rent revenues.
- Define a single reusable store-rent-revenue query over receivable transaction
  types `PAYMENT` and `SETTLEMENT_DEDUCTION`, attributed to the receivable
  period.
- Continue recognizing finalized commission from approved/paid settlement
  snapshots.
- Do not branch-scope net sales, settlement totals, rent, commission, or summary
  cards.
- Branch filters used on list views must not leak into the global summary query.

### Frontend fetching

- Reuse the current organization workspace cache for branch and merchant
  selectors.
- Add a small Finance query cache with short stale times and in-flight request
  deduplication.
- Invalidate only affected payable, summary, settlement, payout, or receivable
  keys after a mutation.
- Keep an explicit Refresh action.
- Use request cancellation in addition to request IDs where supported.
- Use server-returned decimal totals for calculation displays. Client number
  conversion remains formatting-only.

## 13. Phased Delivery and Verification

### Phase A — Agreement duration and rent-cycle foundation

- Add duration/activation/early-end schema and migrations.
- Change draft agreement API and UI.
- Implement anchored anniversary calculations.
- Introduce cycle-based rent receivables.
- Create the first rent receivable atomically on activation.
- Add idempotent catch-up generation.
- Add a guarded development reset/seed command and representative demo data.

### Phase B — Partial rent and manager workflow safety

- Add partial direct rent payments.
- Add individual per-receivable settlement selections.
- Keep the legacy settlement rent-deduction storage field compatible while
  exposing the clearer “Rent deducted” label.
- Add preview revision and closure request ID.
- Support zero payout records.
- Replace adjustment deletion with voiding.
- Add draft cancellation/release workflow.

### Phase C — Query and payload optimization

- Paginate before live row calculation.
- Separate global summary from filtered rows.
- Batch page queries.
- Snapshot settlement branches.
- Paginate settlement and receivable detail collections.
- Move recurring writes out of ordinary reads.
- Add measured indexes.

### Phase D — Write-through accrual projection

- Add projection schema and transactional maintenance.
- Backfill, compare, and reconcile.
- Switch live list and summary endpoints after parity is proven.
- Preserve raw-source verification at close.

### Phase E — Reporting, UX polish, and cleanup

- Correct source-period rent revenue.
- Complete the manager attention queue and detailed workflows.
- Add targeted frontend cache invalidation.
- Remove compatibility DTOs/fields after migration where safe; defer the
  physical settlement column rename until external consumers are migrated.
- Update OpenAPI and Finance/agreement documentation.

### Required tests

- Anniversary periods for normal dates, month-end dates, leap years, and
  multi-month duration.
- Activation, scheduled expiration, and early termination after a rent period
  starts.
- Missing-cycle catch-up and concurrent generator attempts.
- Production-safe migration behavior and development-only reset guards.
- Deterministic demo seed reruns without duplicate records.
- Partial/full direct rent payment with and without active reservations.
- Multiple manually selected receivables and partial final balances.
- Total selected rent below, equal to, and above the payable.
- Zero payout record and duplicate retry.
- Stale preview after sale, refund, adjustment, rent payment, or reservation.
- Duplicate close/approve/payout/cancel requests.
- Concurrent close versus refund, rent payment, adjustment, and payout.
- Cancellation releases each source, adjustment, and allocation exactly once.
- Voided adjustments remain visible and no longer affect live totals.
- Refund commission reverses the original sale's commission basis.
- Tenant isolation for all new IDs and routes.
- Branch filters affect rows but never global summary amounts.
- Source-period direct-rent revenue without double counting deductions.
- Projection parity with raw calculations and safe rebuild.
- Query-count, response-size, and latency regression tests at representative
  volume.

Every phase must run Prisma validation/generation, migration validation,
backend lint/build/tests, frontend lint/typecheck/build/tests, and focused
cross-tenant/concurrency tests before proceeding.

## 14. Development Demo Seed

All product and migration decisions required by this plan are resolved.

The repository does not currently contain a Prisma seed entry point. Add one as
part of Phase A, using stable identifiers or natural unique keys so repeated
development reseeds are deterministic.

The seed must be explicitly development/test-only and must refuse to reset data
when the runtime environment is production. Destructive reset remains a
separate deliberate command; ordinary application startup and database
migration must never invoke it.

The current guarded seed provides a compact finance walkthrough:

- One organization with owner and manager memberships.
- Two branches.
- Two merchants, two branches, products, inventory, and a cross-merchant sale.
- Two active 12-month hybrid agreements activated two months ago.
- Multiple anniversary rent receivables, including a partial direct payment.

Scenario-specific settlement states (draft, cancelled, approved, paid, and
zero-payout) remain better represented by isolated integration fixtures so a
development reseed does not create misleading historical financial records.

Seeded values should be readable examples with documented expected totals so
they serve as both UI demonstration data and calculation fixtures.

## 15. Explicit Non-Goals

- Payment gateway or automated merchant bank payout integration.
- Accounting-system integration.
- Redis, message brokers, microservices, or event sourcing.
- Automatic negative merchant balances or collection enforcement.
- Cancelling/reversing approved or paid settlements.
- Advanced custom settlement schedules.
- Future scheduled agreement activation.
- Branch allocation of merchant-level rent or commission.
- Editing active agreement terms.
