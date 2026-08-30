# Milestone 5 Frontend Part 4: Sales Receipts

## Scope

This part adds a dedicated receipt view for completed online POS transactions.

The receipt uses the immutable transaction-detail API and includes:

- organization and branch identity;
- server sale number and completion time;
- cashier identity;
- historical product, SKU, merchant, quantity, and price snapshots;
- subtotal, discount, and total paid;
- payment method and manual reference; and
- a browser print action.

Receipts are accessible from the completed-sale confirmation and transaction-detail page. Organization, branch, and sale access remain backend-authorized.

## Printing

Application navigation and controls are hidden in print mode, leaving a clean receipt record. Printing uses the browser's native print dialog and does not store or generate a server-side PDF.

The page is labeled **Sales receipt**, not **Official receipt**. Philippine tax-document or accreditation requirements have not been defined for this project, so the interface must not make unsupported compliance claims.

## Deferred

- email or messaging delivery;
- PDF generation or object storage;
- custom receipt numbering or tax registration fields;
- refunds, returns, cancellations, and voids;
- offline receipt queues.
