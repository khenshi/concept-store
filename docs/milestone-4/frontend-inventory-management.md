# Frontend Inventory Management

## Scope

This part completes current-inventory browsing, stock-in, and adjustment workflows for organization owners and managers. Movement-history presentation remains for the next frontend part.

## Current inventory

The Inventory page now supports:

- search by product name, SKU, or barcode
- branch filtering
- merchant filtering
- product-status filtering
- bounded 25-row pagination
- total and visible-range information
- responsive product, merchant, branch, and quantity rows
- explicit negative-quantity styling

## Stock-in

The stock-in modal:

- lists active products
- identifies the product merchant
- allows only branches currently assigned to that merchant
- requires a positive whole-number quantity
- accepts optional reference and note fields
- creates the first visible inventory row when needed
- updates an existing visible row without reloading the page

The backend remains authoritative and repeats all tenant, branch, product, status, and merchant-participation checks.

## Adjustments

Adjustments begin from a specific existing inventory row, so product and branch cannot be changed accidentally. The form:

- displays current quantity and location
- accepts a positive or negative nonzero whole-number change
- requires an explanatory note
- accepts an optional reference
- allows a resulting negative quantity so discrepancies remain visible

## Validation and state

Zod schemas mirror backend quantity and text limits. Request failures stay within the active modal, successful operations are announced, and submission controls expose pending state.

The persistent organization context supplies cached branch data. Products, merchants, and the first inventory page load concurrently. Mutations merge the returned authoritative quantity into local state rather than refetching the application shell or unrelated features.

## Design

The interface follows `DESIGN.md` with flat white surfaces, slate borders, emerald primary actions, restrained overlay elevation, compact operational rows, explicit labels, and responsive task order.

## Explicit exclusions

This part does not show inventory movement history, add low-stock thresholds, export inventory, implement sales movements, or expose merchant self-service.

