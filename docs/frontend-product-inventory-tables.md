# Product and Inventory Tables

## Part 4 scope

This part refines the existing Product catalog and current Inventory views into responsive operational tables. It changes information presentation only; all API calls, filters, mutations, pagination, caching, tenant checks, and authorization behavior remain unchanged.

## Product catalog table

The table separates the catalog concepts that identify and price a merchant-owned product:

- product name
- merchant owner
- SKU and optional barcode
- current selling price
- lifecycle status
- stock, edit, and status actions

The View Stock action retains its product-filtered inventory link. Products continue to represent catalog records rather than physical quantities.

## Current inventory table

The inventory table emphasizes the physical stock relationship:

- product name and SKU
- merchant owner
- physical branch and branch code
- current on-hand quantity
- adjustment action

Negative quantities remain visibly identified as an exception. Stock-in, adjustments, movement history, filters, and pagination retain their existing behavior.

## Responsive behavior

- Tables occupy the available operational canvas on larger screens.
- At narrower tablet widths, tables remain structurally intact inside horizontal overflow containers rather than compressing labels into unreadable columns.
- Headers use semantic table markup and every record has a row header.
- Actions remain explicit text controls and do not rely on unlabeled icon menus.

## Explicit exclusions

- No sorting, bulk selection, export, or product images were added because these are not supported by the current requirements or APIs.
- No inventory policy or calculation changed.
- No POS, sales, or future milestone behavior was introduced.

## Validation

- Prettier formatting
- TypeScript checking
- ESLint
- Frontend tests
- Next.js production build
