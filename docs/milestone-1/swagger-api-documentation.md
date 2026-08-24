# Swagger API Documentation

## Scope

The backend exposes interactive Swagger UI and an OpenAPI JSON document for the API implemented through Milestone 1. This is documentation infrastructure only and does not add business behavior.

The specification includes:

- health, authentication, organization, membership, and branch endpoint groups
- request DTO schemas and validation constraints
- response schemas
- JWT bearer authentication
- the HTTP-only refresh-session cookie
- common success and error responses

## Configuration

`SWAGGER_ENABLED` controls whether the documentation routes are registered.

- Development and test default: enabled
- Production default: disabled
- Explicit `true` or `false` overrides the environment default

Keeping documentation disabled by default in production avoids exposing the API inventory accidentally. Enable it deliberately only when the deployment requires hosted API documentation and its access policy has been considered.

Example:

```env
SWAGGER_ENABLED=true
```

## Routes

When enabled:

- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs/openapi.json`

The Swagger **Authorize** control accepts the short-lived JWT returned by registration, login, or refresh. Refresh and logout use the `concept_store_refresh` HTTP-only cookie, which is normally managed by the browser.

## Maintenance rule

When an endpoint, request DTO, or response shape changes, update its Swagger annotations in the same implementation part. Swagger describes the API but does not replace the milestone behavior documents in `docs/`.

## Validation

The backend checks include OpenAPI document generation, expected route discovery, authentication scheme discovery, environment defaults, build, lint, unit tests, e2e tests, Prisma validation, and formatting.
