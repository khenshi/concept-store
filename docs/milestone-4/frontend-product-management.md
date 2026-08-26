# Frontend Product Management

## Scope

This part completes the owner/manager product-management interface on the Milestone 4 Product route.

## Implemented behavior

- search by product name, SKU, or barcode
- filter by merchant and active status
- create products in a focused modal
- edit name, SKU, barcode, and selling price
- preserve immutable merchant ownership during edits
- activate and deactivate products
- update the visible product list after mutations without refreshing the route
- show loading, filtering, saving, success, empty, access-limited, and request-error states

## Validation

The Zod product schema mirrors backend rules:

- merchant selection is required
- names contain 2–160 characters
- SKUs normalize to uppercase and contain 2–32 letters, numbers, or internal hyphens
- barcode is optional and limited to 64 characters
- selling price is a positive decimal with at most two decimal places

Validation errors remain beside their fields, and the first invalid control receives focus. Backend errors such as duplicate SKU or barcode conflicts remain visible inside the modal.

## Design behavior

The interface follows `DESIGN.md` and the existing authenticated surface:

- white operational panels on the slate workspace
- hairline borders rather than resting shadows
- emerald primary actions and clear text actions
- compact SKU and status labels
- responsive form groups and list rows
- restrained overlay elevation only for the modal interaction

## Data behavior

Products and merchants load together once when the route mounts. Applying filters requests only the matching products. Successful create, edit, and status operations replace the affected item in local state rather than refetching the organization, merchants, or full application shell.

## Explicit exclusions

This part does not create inventory, modify quantities, display movement history, or add merchant self-service.

