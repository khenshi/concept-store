# Milestone 3: Merchant Agreement API

## Scope

This part adds authenticated APIs for creating and editing draft merchant agreements, reading agreement history, explicitly activating an agreement, and ending an active agreement.

It does not calculate rent, commissions, settlements, or payouts; schedule automatic activation; provide agreement deletion; add frontend screens; or implement Milestone 4 functionality.

## Endpoints

All routes require a valid access token and an `OWNER` or `MANAGER` membership in the route organization.

| Method  | Route                                                                      | Behavior                         |
| ------- | -------------------------------------------------------------------------- | -------------------------------- |
| `POST`  | `/organizations/:organizationId/merchants/:merchantId/agreements`          | Create a draft agreement         |
| `GET`   | `/organizations/:organizationId/merchants/:merchantId/agreements`          | List merchant agreement history  |
| `GET`   | `/organizations/:organizationId/merchant-agreements/:agreementId`          | Get one agreement                |
| `PATCH` | `/organizations/:organizationId/merchant-agreements/:agreementId`          | Edit a draft agreement           |
| `PATCH` | `/organizations/:organizationId/merchant-agreements/:agreementId/activate` | Activate or replace an agreement |
| `PATCH` | `/organizations/:organizationId/merchant-agreements/:agreementId/end`      | End an active agreement          |

Commercial amounts are accepted as decimal strings, such as `"2500.00"` and `"5.00"`, preventing floating-point conversion in the API boundary. Business dates use strict `YYYY-MM-DD` input.

## Lifecycle

```text
DRAFT → ACTIVE → ENDED
```

- New agreements always start as `DRAFT`; clients cannot set lifecycle status directly.
- Draft terms and dates may be edited. Optional fixed-rent, commission, and end-date values may be cleared with `null`.
- Activation requires at least fixed rent, commission, or both.
- Active and ended terms cannot be directly edited.
- Only an active agreement can be explicitly ended.
- Ended agreements remain available as immutable history.

## Renewals and extensions

A renewal, extension, or active-term change is represented by a new draft agreement rather than modifying the existing active agreement.

Future-dated drafts are allowed, but activation is manual and cannot occur before the draft's Philippine business `startDate`. Automatic scheduled activation is intentionally deferred.

When a replacement is activated:

1. the replacement must start after the current agreement's start date;
2. the current agreement is marked `ENDED` at the replacement boundary;
3. its `endDate` becomes the day before the replacement starts, unless it already has an earlier end date;
4. the replacement becomes `ACTIVE` in the same database transaction.

This creates a stable historical boundary without extending a previously agreed earlier end date. The partial unique database index remains the concurrency-safe guarantee that a merchant cannot have two active agreements.

## Commercial and date rules

- Fixed rent must be greater than zero and fit `numeric(12,2)`.
- Commission must be greater than zero and no greater than 100, with at most two decimal places.
- Drafts may temporarily omit both commercial terms.
- `endDate` cannot precede `startDate`.
- An expired draft cannot be activated.
- Explicitly ending an agreement cannot use a future Philippine business date because the operation changes its status immediately.
- Settlement schedule is one of `WEEKLY`, `SEMI_MONTHLY`, or `MONTHLY`.

## Tenant isolation and authorization

Every merchant and agreement query uses the organization ID established by the existing organization-access guard. Cross-organization identifiers are returned as unavailable rather than disclosed. Agreement merchant ownership and tenant consistency are also protected by composite database foreign keys.

Cashiers and merchants cannot use these management endpoints. Merchant self-service remains outside this milestone because merchant records are not yet linked to user accounts.

## Validation

Run from `backend/`:

```bash
npm run build
npm run lint
npm test
npm run test:e2e
npm run format:check
```
