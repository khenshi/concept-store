# Milestone 5 Frontend Part 3: Sales History

## Scope

This part adds the read-only operational history for completed online POS sales.

It includes:

- persistent POS tabs for a new sale and sales history;
- branch-scoped sales tables;
- sale-number, payment-method, and completed-date filters;
- bounded pagination;
- cashier, item-count, payment, and total summaries; and
- a dedicated transaction-detail page with immutable product, merchant, price, payment, branch, and cashier snapshots.

## Branch context

Sales remain branch-scoped. History requires a selected branch, and links to transaction details carry that branch context. The backend verifies the organization, branch, and sale combination rather than trusting the URL alone.

Date inputs represent local calendar days and are converted to explicit ISO timestamps before being sent to the API.

## Read-only history

The transaction page intentionally provides no edit, refund, void, delete, or settlement action. Completed-sale history reflects the immutable backend record. Those financial behaviors require separate business rules and are outside Milestone 5.

## Deferred

- printable receipt layout;
- refunds, returns, cancellations, and voids;
- reporting and dashboards;
- offline sales and synchronization.
