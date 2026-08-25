# Milestone 3: Frontend Merchant Agreements

## Scope

This part adds agreement management to an existing merchant profile. Owners and managers can review agreement history, create and edit drafts, activate a draft, and explicitly end an active agreement.

It does not calculate rent, commissions, settlements, or payouts; automatically activate future agreements; delete agreements; or add Milestone 4 functionality.

## Supported terms and lifecycle

Agreements support fixed rent only, commission only, or both. Drafts may temporarily omit both terms. Commercial values remain decimal strings at the API boundary.

```text
DRAFT → ACTIVE → ENDED
```

- Only drafts can be edited.
- Activation requires at least one commercial term and is confirmed before submission.
- Activating a replacement may end the current active agreement at the new historical boundary; the frontend reloads the complete history after activation.
- Only active agreements can be explicitly ended.
- Renewals and extensions are represented by a new draft.
- Weekly, semi-monthly, and monthly settlement schedules are supported.
- The backend remains authoritative for Philippine business dates, activation timing, replacement boundaries, lifecycle state, and tenant isolation.

## Frontend structure

```text
frontend/src/features/merchants/agreements/
├── merchant-agreement-api.ts
├── merchant-agreement.schemas.ts
├── merchant-agreement.types.ts
└── merchant-agreement-management.tsx
```

Agreement data loads independently after the merchant profile is available, so a failure does not block profile, branch, or lifecycle management.

## Validation

Run from `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```
