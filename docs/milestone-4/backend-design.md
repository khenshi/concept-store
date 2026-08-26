# Milestone 4 Backend Design

## Goal

Milestone 4 replaces spreadsheet-based product and branch inventory tracking with a tenant-safe, auditable foundation.

The backend will be delivered in focused parts:

1. Product and inventory data model
2. Product management API
3. Stock-in and inventory adjustment API
4. Inventory views and movement history
5. Backend completion and validation

The frontend begins after the Milestone 4 backend is complete.

## Domain boundaries

### Products

A product belongs to one organization and one merchant. The merchant is the owner of the product, while inventory records identify which branches currently hold it.

Product management includes the name, organization-scoped SKU, optional organization-scoped barcode, current selling price, and active status. Merchant ownership is treated as immutable after creation so historical inventory and future sale attribution cannot silently move to another merchant.

### Inventory

Inventory is the current quantity of one product at one branch. The organization, branch, and product identifiers form the tenant boundary and prevent cross-organization combinations.

The quantity is a current snapshot for efficient reads. It must only be changed in the same database transaction that creates an inventory movement.

### Inventory movements

Inventory movements are append-only records explaining every quantity change. Each movement records the signed quantity change, operation type, responsible user, timestamp, and optional note/reference.

This milestone initially defines only:

- `STOCK_IN` for newly received stock
- `ADJUSTMENT` for explicit corrections

Sale, return, and damaged-stock movement types will be introduced only with the milestones that define those workflows.

## Core rules

- Every record is tenant scoped, and composite foreign keys prevent organization mismatches.
- A SKU must be unique within an organization.
- A non-null barcode must be unique within an organization.
- Selling prices use `Decimal(12, 2)` and must be greater than zero.
- An inventory row is unique per product, branch, and organization.
- Every inventory change must have a nonzero movement and an authenticated actor.
- Stock-in quantities will be positive; adjustments may be positive or negative.
- Product and branch access must be authorized using the authenticated organization context, never a client-supplied organization alone.
- A product may only be stocked at a branch where its merchant currently operates. This is a service-level rule because merchant/branch participation is mutable.

## Negative inventory decision

The database deliberately does not require inventory quantity to be nonnegative. The future offline POS workflow must accept legitimate sales even when multiple disconnected devices exhaust the same cached stock. A negative quantity makes that discrepancy visible for reconciliation instead of discarding a sale.

Online stock operations may still apply stricter service validation where appropriate. This decision does not implement offline behavior in Milestone 4.

## Transaction boundaries

Stock-in and adjustment operations will run as database transactions that:

1. validate tenant, branch, merchant, and product relationships;
2. create or update the current inventory row; and
3. append the matching inventory movement.

The quantity update and movement insert must succeed or fail together.

## Explicit exclusions

This design does not add product variants, categories, images, suppliers, purchasing, warehouses, taxes, cost pricing, sales/POS, returns, damaged-stock workflows, or offline synchronization.

