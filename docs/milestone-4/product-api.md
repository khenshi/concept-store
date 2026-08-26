# Product Management API

## Scope

This part adds tenant-scoped product management for organization owners and managers. It does not create or modify inventory.

## Endpoints

All routes require an access token and an `OWNER` or `MANAGER` membership in the organization.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/organizations/:organizationId/products` | Create a merchant-owned product |
| `GET` | `/organizations/:organizationId/products` | List and filter products |
| `GET` | `/organizations/:organizationId/products/lookup?code=...` | Find one product by exact SKU or barcode |
| `GET` | `/organizations/:organizationId/products/:productId` | Get one product |
| `PATCH` | `/organizations/:organizationId/products/:productId` | Update product details |
| `PATCH` | `/organizations/:organizationId/products/:productId/status` | Set product status |

The list endpoint supports `search`, `merchantId`, and `status`. Search matches the product name, SKU, or barcode case-insensitively.

## Code behavior

- SKU is required, normalized to uppercase, and limited to 2–32 letters, numbers, or single hyphen-separated groups.
- Barcode is optional, trimmed, and limited to 64 characters.
- SKU and non-null barcode values must each be unique within the organization.
- Exact code lookup checks SKU case-insensitively and barcode exactly.
- The response includes the product's merchant summary so callers do not need another request to identify its owner.

## Product rules

- The authenticated organization context supplies the tenant ID.
- The selected merchant must belong to the same organization.
- Merchant ownership cannot be changed through product updates.
- Selling price is accepted as a positive decimal string with at most two decimal places and returned as a two-decimal string.
- Products are deactivated through status changes rather than deleted, preserving references for inventory and future sales history.
- Product creation does not create an inventory row. Stock is established only by a stock-in operation in the next backend part.

## Errors

- Cross-organization or missing products return `404` without exposing another tenant's data.
- A merchant outside the organization is rejected with `400`.
- Duplicate SKU or barcode values return `409`.
- Empty updates and invalid input return `400`.

## Validation

The implementation was verified with Prisma generation, the NestJS build, ESLint, Prettier, and unit tests covering tenant filters, merchant validation, product lookup, update behavior, and uniqueness errors.

