# Milestone 4 Frontend Foundation

## Scope

This part establishes the frontend structure for products and inventory and adds functional read-only organization pages. Product creation/editing, stock operations, filters, movement history, and pagination controls remain for the following frontend parts.

## Routes

```text
/app/organizations/:organizationId/products
/app/organizations/:organizationId/inventory
```

Both routes are linked from the persistent organization sidebar and workspace overview for owners and managers. Cashier and merchant navigation remains hidden because the backend does not currently authorize those roles for these endpoints.

## Feature structure

```text
src/features/products/
  product-api.ts
  product-api.spec.ts
  product-directory.tsx
  product.types.ts

src/features/inventory/
  inventory-api.ts
  inventory-api.spec.ts
  inventory-overview.tsx
  inventory.types.ts
```

Feature-specific API clients keep request construction separate from page components. Shared backend response and input contracts are represented by explicit TypeScript types.

## Current interface

The Product page displays:

- product name and SKU
- merchant owner
- optional barcode
- current price in Philippine pesos
- active status
- loading, empty, and error states

The Inventory page displays:

- current quantity
- product name and SKU
- merchant owner
- branch
- visible negative-quantity treatment
- loading, empty, and error states

The pages follow `DESIGN.md`: flat white surfaces, slate borders, emerald used for focused state, restrained rounding, operational density, and responsive list rows.

## Data loading

The existing organization layout remains mounted between organization routes. This preserves organization and lazily loaded branch context rather than rebuilding shared workspace state on every navigation.

Products and inventory are independent datasets and are fetched only by their respective pages. No new state-management or query dependency was introduced because the current application does not yet need that additional abstraction.

## API coverage

The data layer supports the complete Milestone 4 backend surface so later UI parts do not duplicate request logic:

- product list, lookup, create, detail, update, and status changes
- inventory list and movement history
- stock-in and inventory adjustments

## Explicit exclusions

This part does not expose product or inventory write controls, filters, movement history, merchant self-service, or offline behavior.

## Validation

- TypeScript typecheck
- ESLint
- 26 Vitest files with 68 passing tests
- production Next.js build
- Prettier

