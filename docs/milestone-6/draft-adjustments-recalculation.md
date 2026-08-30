# Milestone 6 Part 5: Draft Adjustments and Recalculation

## Scope

This part lets an organization owner or manager add, edit, and remove explicit adjustments on a draft merchant settlement. It also lets them recalculate a draft from current eligible sales and agreement terms.

It does not add settlement lifecycle transitions, approvals, payouts, frontend screens, or editing of finalized financial records.

## API

All routes require authentication, current organization membership, and the `OWNER` or `MANAGER` role.

| Method   | Route                                                                                | Purpose                        |
| -------- | ------------------------------------------------------------------------------------ | ------------------------------ |
| `POST`   | `/organizations/:organizationId/settlements/:settlementId/recalculate`               | Recalculate a draft settlement |
| `POST`   | `/organizations/:organizationId/settlements/:settlementId/adjustments`               | Add an adjustment              |
| `PATCH`  | `/organizations/:organizationId/settlements/:settlementId/adjustments/:adjustmentId` | Edit an adjustment             |
| `DELETE` | `/organizations/:organizationId/settlements/:settlementId/adjustments/:adjustmentId` | Remove an adjustment           |

An adjustment accepts a signed, nonzero decimal amount with at most two decimal places and a required reason of at most 500 characters. Positive values increase the merchant payout; negative values decrease it. The backend derives the actor, organization, adjustment total, and net payout rather than accepting those values from the client.

## Draft-only integrity

Adjustment mutations and recalculation are allowed only while the settlement is `DRAFT`. Reviewed, approved, and paid settlements remain immutable so their recorded financial meaning cannot silently change.

Every finance mutation runs in a serializable database transaction. Inside that transaction the service:

- revalidates that the authenticated actor is still an owner or manager;
- scopes the settlement and adjustment to the trusted organization;
- conditionally updates only a settlement that is still a draft; and
- converts uniqueness, database-constraint, and serialization conflicts into a safe conflict response.

Adjustment totals are always aggregated from persisted adjustment rows. The settlement's net payout is then recalculated as:

```text
gross sales - commission - fixed rent + adjustments
```

## Recalculation behavior

Recalculation re-runs the server-authoritative agreement segmentation and eligible-sale calculation for the settlement's original merchant and period. It atomically replaces derived agreement snapshots and sale-item links, updates the calculating actor and timestamp, and preserves the settlement's explicit adjustments.

Sale items already linked to the settlement remain eligible during its recalculation. Sale items claimed by another settlement remain excluded. This allows newly completed eligible sales to be included without permitting duplicate settlement attribution.

No totals, prices, organization identifiers, agreement terms, or sale selections are trusted from the frontend.

## Validation

Unit and HTTP-boundary tests cover adjustment total recomputation, draft immutability, source replacement during recalculation, DTO validation, organization/actor forwarding, and OpenAPI route publication.
