# Merchants, Spaces, and Agreements

**Status:** Current reference

## Agreement-led occupancy

Agreements are the only way to create new merchant space occupancy. Each draft
selects one or more active spaces from branches in which the merchant
participates. Draft selections are advisory and do not reserve space. Submission
rechecks availability transactionally and creates dated reservations.

Pending, approved, and active agreement reservations block overlapping use of a
space. PostgreSQL also enforces this rule with a date-range exclusion constraint.
Open assignments created by the former manual workflow remain read-only history
and block conflicting submissions until they are ended. Only those legacy
assignments expose a direct end action.

Activation creates agreement-linked `SpaceAssignment` rows atomically. Ending or
suspending an active agreement ends all of its assignments on the same Philippine
business date; assignment history is never deleted.

## Agreement lifecycle

The lifecycle is:

```text
DRAFT → PENDING → APPROVED → ACTIVE → ENDED
  │        │          │          │
  └────────┴──────────┴──────────┴→ SUSPENDED
```

- A merchant may have at most five numbered drafts, one pending agreement, and
  one active agreement in an organization.
- Drafts may be edited or submitted. Submitted terms are immutable.
- A pending agreement may be withdrawn or returned to an available draft slot;
  doing so releases its reservations.
- Approval moves a paid, conflict-free submission to `APPROVED`.
- Approved agreements activate on their configured Philippine business date. An
  owner may activate early, which resets the activation date, period,
  reservations, assignments, and first rent period to the actual activation.
- Reconciliation runs at backend startup and at each Philippine midnight to
  safely activate due approved agreements and end expired active agreements.
  Activation failures are retained for owner review and retried on a later run.
- `ENDED` and `SUSPENDED` are immutable historical states. `SUSPENDED` covers a
  discarded draft, cancelled approved agreement, or terminated active agreement.

Agreement terms support fixed rent, commission, or both, a 1–60 month duration,
weekly/semi-monthly/monthly settlement schedule, and—when rent is used—a chosen
first/second/third/fourth/last week plus Monday–Sunday collection day.

## Deposit and first-rent prerequisites

An agreement may require a security deposit and may require the first rent before
approval. Submission opens the enabled balances. Owners and managers can record
pending collections, with tenant-scoped idempotency IDs, only after submission.
Approval remains blocked until every enabled balance is fully collected.

Collections, refunds, retained amounts, deposit deductions, and first-rent
application are append-only ledger entries. Collections cannot exceed the
required amount; refunds and deductions cannot exceed the held balance. Deposit
deductions are available only after activation.

At activation, a paid first-rent prepayment is applied to the first rent
receivable without recording a second payment. Otherwise the first receivable is
open and due immediately. Later rent receivables use the selected collection
week and weekday. Existing migrated agreements without this schedule retain
their anniversary-based rent behavior.

Cancelling an approved agreement requires the owner to resolve each held balance:
refund it with payment details or retain it with a reason. Suspending an active
agreement does not automatically refund rent. Ended or suspended agreements keep
showing an unresolved deposit until its balance is refunded or deducted to zero;
that warning does not block a later agreement.

## Access and interface

Owners and managers may create, edit, submit, withdraw, and collect pending
payments. Only owners may approve, return, activate early, cancel an approved
agreement, or suspend an active agreement.

The organization agreement register is the overview surface. It has Draft,
Pending Review, Approved, Active, Ended, and Suspended tabs and links each row to
a dedicated detail page. Lifecycle actions and warnings live on that detail page
instead of competing with register scanning. New agreements use a full-page
draft form: the user browses spaces one branch at a time, while selections are
preserved across branches so a merchant agreement can cover multiple locations.
Saving stays separate from submission. The register refreshes when opened and
when its browser tab regains focus. Merchant summaries link to this register;
space pages show agreement occupancy and legacy history rather than offering
manual assignment creation.

## Current API surface

Agreement lifecycle routes are under
`/organizations/:organizationId/merchant-agreements/:agreementId` and include
`submit`, `withdraw`, `return-to-draft`, `approve`, `activate`, `cancel`,
`suspend`, and `discard`. Prepayment routes expose balances, collections,
refunds, and deposit deductions. `GET /organizations/:organizationId/spaces/availability`
provides advisory availability; submission and activation always revalidate on
the server.
