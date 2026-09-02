# Concept Store Settlement & Merchant Receivables Refactor Plan

## Goal

Refactor the financial workflow so owners and managers can always see a merchant's **live payable position** without first creating a settlement, while keeping rent obligations separate and auditable.

The design should distinguish three financial concepts:

- **Live Payable** — money the concept store currently owes the merchant.
- **Merchant Receivable** — money the merchant owes the concept store, such as unpaid rent.
- **Settlement** — a locked financial snapshot used to close and pay eligible merchant activity.

The system should allow rent to be optionally deducted during settlement while preventing negative merchant payouts.

---

# Recommended Module Structure

## 1. Settlements Module

Responsible for:

- Live merchant payable calculations
- Settlement schedules and deadlines
- Early settlements
- Settlement creation and snapshots
- Review and approval
- Payout recording
- Settlement history
- Overdue settlement handling

The Settlements module should **not own outstanding merchant rent balances**.

---

## 2. Merchant Receivables Module

Responsible for money merchants owe the concept store.

Initial supported receivable:

- Fixed rent

Future receivables may include:

- Penalties
- Utilities
- Service fees
- Other merchant charges

Each receivable should track:

- Merchant
- Branch / agreement
- Type
- Original amount
- Remaining balance
- Due date
- Source period
- Status
- Payments / settlement deductions
- Audit history

Suggested statuses:

```text
OPEN → PARTIALLY_PAID → PAID
              ↓
           OVERDUE
```

A merchant may continue selling while receivables remain outstanding unless the owner later chooses to enforce suspension rules.

---

# Core Financial Flow

```text
Merchant Agreement
(settlement schedule + rent + commission terms)
        ↓
Sales / Refund Activity
        ↓
Live Merchant Payable
        ↓
Owner / Manager views current numbers
        ↓
Wait Until Deadline OR Settle Early
        ↓
Settlement Preview
        ↓
Optional Rent / Receivable Deduction
        ↓
Create Settlement
        ↓
Review
        ↓
Owner Approves & Locks
        ↓
Record Payout
        ↓
PAID
        ↓
Exclude settled activity from Live Payable
        ↓
Update receivable balances
        ↓
Advance to next regular settlement deadline
```

---

# Live Payable

The backend should continuously calculate live payable from eligible **unsettled financial activity**.

Example:

```text
Gross Sales
− Completed Refunds
= Net Sales

Net Sales
− Commission
± Settlement-related adjustments
= Current Merchant Payable
```

Fixed rent should **not automatically reduce the live payable**.

Instead, rent should be shown separately as a merchant obligation.

The live payable detail should display:

- Gross sales
- Refunds
- Net sales
- Commission
- Other deductions
- Current merchant payable
- Outstanding rent / receivables
- Current settlement deadline
- Settlement status
- Overdue amount if applicable

---

# Settlement Schedules and Deadlines

Merchant agreements continue to define schedules such as:

- Weekly
- Semi-monthly
- Monthly

The current deadline should remain visible in the live payable view.

Owners can settle early.

Example:

```text
Settlement schedule: Weekly
Current deadline: Dec 8
Settlement completed: Dec 5
Next deadline: Dec 15
```

The next deadline must follow the **original schedule boundaries**, not be calculated relative to the early payout date.

---

# Early Settlement

The owner can select **Settle Now** before the scheduled deadline.

The system should:

1. Determine the eligible unsettled activity through the selected cutoff date.
2. Calculate the merchant payable.
3. Show applicable merchant receivables.
4. Let the owner choose whether to deduct eligible receivables.
5. Show the final merchant payout.
6. Create a settlement snapshot only after confirmation.

The system must prevent any source transaction or refund from being included in multiple settlements.

---

# Rent Handling

## Rent Creation

Monthly fixed rent should create or maintain a separate merchant receivable.

Example:

```text
Rent Receivable

Merchant: ABC Clothing
Period: December
Rent Due: ₱10,000
Remaining: ₱10,000
Due Date: Dec 31
Status: OPEN
```

Rent remains separate from settlement calculations until the owner chooses to offset it.

---

## Rent Deduction During Settlement

In the settlement preview, show a toggle such as:

```text
[✓] Deduct outstanding rent

Rent due:               ₱5,000
Maximum deductible:     ₱5,000
Remaining after:            ₱0
```

When disabled:

- Merchant receives the full calculated payable.
- Rent remains outstanding.

When enabled:

```text
Final Merchant Payout
= Merchant Payable − Applied Receivable Deduction
```

---

# When Payable Cannot Cover Rent

Merchant payouts must never become negative.

Example:

```text
Merchant Payable:       ₱2,000
Outstanding Rent:       ₱5,000
```

If rent deduction is enabled:

```text
Rent Deducted:          ₱2,000
Merchant Payout:            ₱0
Remaining Rent:         ₱3,000
```

The remaining ₱3,000 stays as an outstanding merchant receivable.

---

# Month-End Rent Shortfall

If the last settlement of the month still cannot cover the monthly rent:

```text
Monthly Rent:           ₱10,000
Previously Deducted:     ₱6,000
Final Payable:           ₱2,500
```

The final settlement can deduct:

```text
Rent Deducted:           ₱2,500
Merchant Payout:             ₱0
Outstanding Rent:        ₱1,500
```

The remaining ₱1,500 becomes an **outstanding rent balance** associated with that original month.

Do not silently merge it with the next month's rent.

Example:

```text
Outstanding December Rent:   ₱1,500
January Rent:                ₱10,000
```

This keeps financial history clear and auditable.

---

# Outstanding Rent Enforcement

A merchant may continue selling while rent remains outstanding.

This is intentional because future sales may allow the store to recover the receivable through later settlements.

The system should provide controls to reduce the risk of rent remaining unpaid indefinitely.

Recommended flow:

```text
Rent Due
   ↓
Outstanding
   ↓
Grace Period
   ↓
Overdue
   ↓
Owner Action Required
```

Possible owner actions:

- Deduct from a future settlement
- Record separate payment
- Partial payment
- Waive / adjust with documented reason
- Suspend merchant agreement manually if necessary

Future policy configuration may support automatic enforcement, but initial implementation should avoid automatically disabling merchant sales.

---

# Separate Rent Payment

The Merchant Receivables module should support recording a payment made directly by the merchant.

Possible methods:

- Cash
- GCash
- Bank transfer
- Other manual method

A receivable payment should store:

- Amount
- Payment date
- Payment method
- Reference number
- Note
- Recording user
- Timestamp

Partial payments should reduce the remaining receivable balance.

---

# Overdue Settlement Handling

If a settlement deadline passes without settlement:

```text
Live Payable
      ↓
Deadline Passed
      ↓
OVERDUE
```

Do not automatically advance the deadline.

Example:

```text
Current Due:             ₱39,700
Deadline:                Dec 8
Status:                  OVERDUE
Overdue by:              3 days
```

New merchant activity can continue accumulating.

The frontend should distinguish:

```text
Overdue amount due Dec 8     ₱39,700
New accrued activity          ₱6,200
────────────────────────────────────
Total current payable         ₱45,900
```

Prefer settling the overdue scheduled portion while newer activity continues toward the next deadline.

After the overdue obligation is paid, advance to the next regular schedule boundary.

---

# Frontend Flow

## Settlements Overview

The page should answer:

> What do we currently owe each merchant, when is it due, and are there any merchant balances owed to the store?

Recommended summary cards:

- Total Current Payables
- Due Soon
- Overdue Payables
- Outstanding Merchant Receivables
- Paid This Period

Recommended merchant table:

| Merchant | Branch | Current Payable | Rent / Receivables | Deadline | Status | Action |
|---|---|---:|---:|---|---|---|
| ABC Clothing | Main | ₱8,000 | ₱3,000 | Dec 8 | Accruing | View |
| XYZ Goods | Main | ₱12,000 | ₱0 | Dec 8 | Due Soon | View |
| Merchant C | North | ₱4,500 | ₱2,000 | Dec 1 | Overdue | View |

Filters:

- Branch
- Merchant
- Settlement status
- Deadline
- Receivable status

---

# Live Merchant Detail

Example layout:

```text
ABC Clothing

Current Payable                     ₱8,000
Current Deadline                    Dec 8
Outstanding Rent                    ₱3,000

Current Period
Dec 1 → Dec 8

Gross Sales                        ₱10,000
Refunds                              -₱500
Net Sales                           ₱9,500
Commission                          -₱1,500
──────────────────────────────────────────
Current Merchant Payable            ₱8,000

[ Settle Now ]
```

Suggested detail sections or tabs:

- Current Activity
- Sales
- Refunds
- Agreement Terms
- Receivables
- Settlement History

---

# Settlement Preview UI

When the owner clicks **Settle Now**:

```text
Settle ABC Clothing

Cutoff: Dec 5

Merchant Payable                  ₱8,000
Outstanding Rent                  ₱3,000

[✓] Deduct outstanding rent

Rent deduction                    -₱3,000
────────────────────────────────────────
Final Merchant Payout             ₱5,000

Next Regular Deadline:
Dec 15

[ Cancel ]     [ Create Settlement ]
```

If the payable cannot cover rent:

```text
Merchant Payable                  ₱2,000
Outstanding Rent                  ₱5,000

[✓] Deduct outstanding rent

Rent deducted                     -₱2,000
Merchant payout                       ₱0
Remaining rent                     ₱3,000
```

The UI should clearly explain that the remaining rent will stay outstanding.

---

# Merchant Receivables Frontend

Add a dedicated **Receivables** area either:

- As a tab inside Merchants / Settlements, or
- As a dedicated financial page if the project grows.

Recommended initial approach:

```text
Settlements
├── Live Payables
├── Settlement History
└── Merchant Receivables
```

Receivables table:

| Merchant | Type | Source Period | Original | Remaining | Due Date | Status |
|---|---|---|---:|---:|---|---|
| ABC Clothing | Rent | Dec 2026 | ₱10,000 | ₱3,000 | Dec 31 | Open |
| XYZ Goods | Rent | Dec 2026 | ₱8,000 | ₱8,000 | Dec 31 | Overdue |

Receivable detail should show:

- Original charge
- Remaining balance
- Payments
- Settlement deductions
- Due date
- Status
- Source agreement
- Audit history

Available actions:

- Record Payment
- Apply Adjustment
- View Related Settlements

---

# Settlement Completion

Settlement lifecycle remains:

```text
DRAFT → REVIEWED → APPROVED → PAID
```

After payout:

1. Mark included transactions/refunds as settled.
2. Update applied receivable balances.
3. Record the payout.
4. Change settlement to `PAID`.
5. Recalculate the live payable using remaining/unsettled activity.
6. Advance the deadline to the next regular schedule boundary.
7. Preserve the settlement as immutable history.

Financial state changes should happen transactionally where appropriate.

---

# Backend Rules

- Backend is authoritative for all money calculations.
- Use decimal-safe arithmetic.
- Merchant payable and merchant receivables must remain separate concepts.
- Never allow merchant payout below zero.
- A settlement may offset receivables only up to the merchant payable amount.
- A receivable may be partially paid.
- Historical receivable periods must remain identifiable.
- Prevent duplicate settlement inclusion.
- Prevent deductions from reducing the same receivable twice.
- Preserve agreement snapshots.
- Preserve tenant and organization isolation.
- Preserve role-based authorization.
- Preserve immutable approved/paid settlements.
- Preserve append-only financial audit history.

---

# Cleanup

**Implementation status:** Completed. The legacy scheduled-generation fields,
settlement rent-accrual fields, duplicated rent-policy snapshot fields, and
single-purpose adjustment/receivable discriminator columns have been removed.
Historical settlement, payout, agreement snapshot, allocation, receivable
transaction, and audit records remain preserved.

After completing the refactor:

- Remove obsolete automatic rent-deduction logic from live settlement calculations.
- Remove legacy settlement-generation flows that are no longer necessary.
- Remove duplicate calculation paths.
- Remove obsolete endpoints, services, DTOs, types, components, actions, database fields, and tests.
- Remove dead code, unused imports, redundant queries, and outdated documentation.
- Keep one authoritative backend calculation path for live payables.
- Keep receivable accounting separate from merchant payable calculations.
- Safely migrate/remove database structures only after confirming they are not required for historical records.
- Preserve historical settlements, payouts, agreement snapshots, receivable history, and audit logs.
- Avoid unrelated refactors or unnecessary complexity.

---

# Final Conceptual Model

```text
SALES / REFUNDS
      ↓
LIVE MERCHANT PAYABLE
      ↓
                MERCHANT RECEIVABLES
                (Rent, future charges)
                       ↓
             Optional Offset at Settlement
                       ↓
SETTLEMENT SNAPSHOT
      ↓
APPROVAL
      ↓
PAYOUT
      ↓
PAID

Remaining Receivable
      ↓
Future Settlement Deduction
OR
Separate Merchant Payment
```

This separation keeps the accounting understandable:

- The store can always see what it owes merchants.
- Rent is independently tracked as money merchants owe the store.
- Settlements may offset the two when appropriate.
- Unpaid rent remains visible and collectible without corrupting settlement history.
