# Plan 03: Authentication and request-boundary hardening

Status: Local implementation completed in `638280a`; superseded as the active
plan on October 25, 2026 when Plan 07 became current. This is an implementation
record, not a release-complete claim.

Implemented locally: 72-byte new-password validation with legacy login
compatibility, session-bound access tokens and immediate revocation checks,
account-owned session listing/revocation, auth dependency 503 handling,
post-auth throttling, direct request identity handling, nested log redaction and
production Swagger/SQL-parameter restrictions.

Remaining acceptance gates are owned by the active queue: Plan 07 onboarding,
verification and reset integration; Plan 05 hosted proxy identity, cookies and
CSRF; Plans 11/14 browser and shared-device acceptance; and Plan 18 durable
checkout/refund recovery. See the dated evidence in
`docs/validation/auth-security-2026-10-25.md` and the background-agent audit.
