# Milestone 6 Part 4: Settlement Read and Generation API

## Scope

This part exposes authenticated owner/manager endpoints for generating a settlement draft, listing organization settlements, and viewing one settlement with its calculation sources.

It does not add draft recalculation, adjustments, review, approval, payout recording, merchant access, or frontend behavior.

## Endpoints

| Method | Route                                                            | Behavior                                  |
| ------ | ---------------------------------------------------------------- | ----------------------------------------- |
| `GET`  | `/organizations/:organizationId/settlements`                     | List and filter organization settlements  |
| `POST` | `/organizations/:organizationId/settlements`                     | Generate a server-calculated draft        |
| `GET`  | `/organizations/:organizationId/settlements/:settlementId`       | View totals, terms, sales, and adjustments |

All routes require a valid access token, membership in the route organization, and an `OWNER` or `MANAGER` role. Cashiers and merchants cannot access these finance endpoints.

## Draft generation request

The request contains only:

```json
{
  "merchantId": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "periodStart": "2026-07-01",
  "periodEnd": "2026-07-31"
}
```

Unknown and server-authoritative fields are rejected. In particular, the client cannot provide agreement terms, gross sales, commission, rent, adjustments, net payout, actor identity, or lifecycle status.

The controller forwards the organization and actor from trusted authenticated context. The service re-checks the actor's current owner/manager membership inside the serializable calculation transaction.

## List filters

Supported filters:

- `merchantId`;
- `status`;
- `periodFrom`, applied to period start;
- `periodTo`, applied to period end;
- `offset`; and
- `limit`, bounded to 1–100.

Dates are strict `YYYY-MM-DD` values and reversed filter ranges are rejected. Every query includes the trusted `organizationId`.

## Detail response

Settlement detail includes:

- header totals and lifecycle actor/timestamp fields;
- merchant summary;
- immutable agreement-term snapshots;
- attributed sale-item sources with product, quantity, sale number, completion time, and gross amount;
- draft adjustments when later implemented; and
- payout when later implemented.

All decimal monetary and percentage values are returned as strings. This avoids floating-point loss in JSON clients.

Cross-organization or unknown settlement IDs are concealed as `Settlement not found` by the tenant-scoped service query.

## Validation and API documentation

- DTO validation rejects unknown fields, malformed UUIDs, invalid statuses, malformed dates, and pagination outside allowed bounds.
- Swagger publishes request, list, summary, term, sale-source, adjustment, payout, and detail schemas.
- HTTP tests cover authentication, tenant concealment, RBAC, trusted actor forwarding, client-calculated-field rejection, filter transformation, detail routing, and OpenAPI publication.

## Next part

The next backend part can implement draft adjustments and recalculation. Both must remain draft-only, update header totals atomically, preserve tenant isolation, and prevent stale or finalized records from changing.

