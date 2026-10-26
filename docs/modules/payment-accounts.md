# Payment Accounts

**Status:** Implemented for the approved Plan 08 development cutover.

## Responsibilities and exclusions

Payment Accounts are the organization-scoped configuration used for new POS
sales and refunds. Each account is an individual configured destination such as
Cash, GCash Main, Maya or BPI. The module does not verify provider balances and
does not implement reconciliation sessions, cash drawers, statement imports,
settlements, a ledger or split payments.

Recorded Sale and Refund rows remain the source of reporting amounts. They keep
an immutable payment-account ID and display/behavior snapshots so later account
renames, disables or branch-assignment changes do not rewrite history.

## API

```text
GET   /organizations/:organizationId/payment-accounts
POST  /organizations/:organizationId/payment-accounts
PATCH /organizations/:organizationId/payment-accounts/:accountId
GET   /organizations/:organizationId/branches/:branchId/payment-accounts?operation=SALE|REFUND&history=
```

Organization-level list/create/update operations are Owner-only. The branch
availability endpoint is available to Owners, assigned Managers and assigned
Cashiers for sale selections; Cashiers cannot request refund selections.
Merchants cannot select payment accounts for POS or refunds. Current membership,
verified-user state, organization status and branch access are checked on the
server for every request.

The management update is one versioned operation covering name, enabled state,
reference policy and branch assignment. There is no delete endpoint. A stale
version returns a conflict and branch assignments are replaced atomically.

## Account rules

- Every organization has exactly one system-provided `Cash` account.
- Cash is fixed, always enabled, available to every branch, requires no
  reference and cannot be renamed, reassigned or deleted.
- Custom account names are trimmed and unique case-insensitively within the
  organization. Custom accounts may be enabled or disabled and may use
  `ALL` branches or an explicit nonempty `SELECTED` branch set.
- A custom account may require a 2–100 character transaction reference. The
  policy applies to new commands only; completed snapshots remain unchanged.
- `ALL` dynamically includes future branches. `SELECTED` uses tenant-safe
  account/branch links. Foreign or inaccessible branch IDs are rejected.
- Account assignment and enabled-state checks are repeated inside the checkout
  or refund transaction. Frontend option visibility is not authorization.
- New refunds choose and validate the actual payout account independently of
  the original sale account. A disabled or unassigned account may remain in
  authorized historical views and replayed completed commands but cannot be
  used for a new completion.

Configuration writes and payment completion use a consistent organization and
account locking/version protocol. A losing concurrent command fails without a
partial sale, refund or stock mutation. Identical completed request IDs replay
their saved immutable response after fresh authorization, including after an
account is renamed, disabled or unassigned.

## Data model

`PaymentAccount` is tenant-owned and has a stable UUID, display name, enabled
state, `ALL`/`SELECTED` assignment mode, optional system key, reference policy,
version and timestamps. `PaymentAccountBranch` links selected accounts to
same-organization branches with tenant-safe foreign keys. PostgreSQL triggers
protect Cash identity, branch-assignment invariants and Sale/Refund snapshot
immutability.

Sale and Refund continue to store their own exact decimal totals and completion
dates. Payment-account IDs and snapshots are restrictive composite foreign-key
references to the same organization account. No duplicate payment or ledger
row is introduced.

## Reporting integration

Sales Reports independently aggregate completed Sale totals as `Received` and
completed Refund totals as `Refunded`, grouped by the account actually used.
`Net Received` is `Received - Refunded`; refunds are grouped by their payout
account and completion date, not by the original sale account. The response
uses stable account IDs, current display labels, exact two-decimal strings and
transaction/refund counts. Current applicable zero-value accounts and all
historically contributing accounts in the authorized period are included.

Owners and assigned-branch Managers receive the account breakdown. Merchant
reports remain own-item-only and do not expose whole-sale payment-account data.
Branch/date filters and the existing Manila-calendar period behavior remain
authoritative. These figures describe recorded transaction flows, not verified
external balances.

## Frontend

Owners manage accounts from the organization sidebar at
`/app/organizations/:organizationId/payment-accounts`. The page uses the shared
operational collection, filters, versioned modal form and branch-access picker.
Cash has no edit action; custom accounts expose edit and enable/disable controls.
Save is disabled for invalid or unchanged drafts, and success/error feedback
uses the shared floating notice/footer patterns.

POS, refund, sales-history and receipt/replay flows use dynamic account data.
Selectors show only accounts enabled and assigned for the current branch and
operation, while authorized historical rows can identify disabled or no-longer-
assigned accounts without changing saved records.

## Verification status

Plan 08 has focused backend integration coverage for tenant isolation, Cash
invariants, branch assignment, role/operation visibility, snapshots, replay,
refund attribution, exact account aggregates and configuration/completion races.
Frontend account-management, dynamic-selection, report-toggle and merchant
privacy regressions are covered by focused tests. Disposable database and
frontend build evidence is recorded in
`docs/validation/plan08-implementation-2026-10-25.md`.

The development database cutover remains a separate operational gate. The
forward migration intentionally stops when existing Sale or Refund source rows
are present; apply it only to the explicitly verified disposable replacement
database, then reseed and reload matching API/frontend versions.
