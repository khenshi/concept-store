# Milestone 5 Frontend Part 2: Online Checkout

## Scope

This part connects the POS cart to the online checkout API.

It includes:

- a unified payment modal without a redundant close button;
- `CASH`, `GCASH`, `BANK_TRANSFER`, and `OTHER` payment selection;
- required transaction references for every non-cash method;
- a client-generated transaction UUID preserved across retries;
- server-authoritative checkout submission;
- clear saving and request-error states;
- completed-sale confirmation with the server sale number; and
- catalog refresh after a successful inventory deduction.

## Payment assumption

The initial interface records one payment method per sale. Split payments are not required by the current product scope. Although the API data model can preserve multiple payments, exposing split payment behavior requires explicit business and UX rules and is therefore deferred.

Cash tendered and change due are also not collected because the current backend records only the amount applied to the sale. The frontend sends the displayed cart total as the payment amount, but the backend independently recalculates product prices and rejects any mismatch.

## Retry safety

A new `clientTransactionId` is created when the cashier opens payment. The same identifier remains in use while the payment modal stays open, including after request errors. Retrying therefore returns the existing server sale if the first request completed but its response was lost.

Closing payment and starting a new checkout creates a new identifier.

## Deferred

- printable receipt presentation;
- sales history and transaction-detail pages;
- split payments;
- cash tendered and change calculation;
- discounts, returns, refunds, and voids;
- offline persistence and synchronization.
