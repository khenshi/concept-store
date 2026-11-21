# Plan 05: Hosting selection and secure session topology

Date: October 24, 2026

Status: Approved for staged implementation October 25, 2026. Provider
provisioning, billing, DNS/secrets changes, deployments and database operations
remain unauthorized. User confirmed a same-origin `/api` proxy. Provider
selection and real-data qualification remain open.

Priority: P0 deployment gate. Preserve free-first testing where feasible, but do
not claim free infrastructure meets the approved ≤15-minute data-loss / ≤2-hour
safe-recovery targets without the Plan 04 drill.

## 1. Goal, scope and exclusions

Choose a low-cost deployment path for the existing Next.js → NestJS → PostgreSQL
application and define secure browser/API/session routing. Support controlled
testing for 1–2 organizations without presenting a test setup as reliable live POS.

Owns hosting/origin/cookie topology gates in the
[deployment checklist](../../deployment-readiness-checklist.md). Reuse runtime
contracts (02), auth/session policy (03) and DB safety/recovery targets (04).

Included: provider evaluation, runtime/port/build requirements, same-origin proxy,
cookie/CORS/CSRF boundaries, ingress identity contract, environment separation,
cost/upgrade gates and actual deployed/browser verification design.

Excluded: provider provisioning or billing now, changing app frameworks, static
export conversion, combining Next/Nest in one process, Kubernetes, new queues/
caches/datastores, automated subscriptions and selecting an email provider (07).
06 owns release automation; 10 monitoring; 12 workload measurement; 14 sign-off.

## 2. Current repository evidence

- `frontend/next.config.ts` has no API rewrite/proxy. It validates an absolute
  HTTP(S) `NEXT_PUBLIC_API_URL`; AuthClient appends paths and uses credentials.
  The Next app is built with webpack and runs as a server, not a static export.
- Frontend production `start` hardcodes port 3001. Host-assigned `PORT` must be
  supported deliberately without changing the existing local dev port by accident.
- Backend uses validated `PORT`, exact `FRONTEND_ORIGIN`, credentialed CORS,
  Helmet and strict DTOs. No explicit trust-proxy policy exists; 03 owns that fix.
- Refresh cookies are HttpOnly, Secure in production, SameSite=Lax, host-only
  (no Domain) and Path=/auth. Clear uses the same attributes. Browser cookie
  matching follows the public URL, not the upstream Nest path behind a proxy.
- No tracked host manifest or deployed topology was established by the review.
  Existing dashboards/secrets/custom domains are unverified, not assumed absent.
- Plan 04 now requires ≤15 minutes lost data and ≤2 hours through validated
  restoration/reconnection. Selecting a provider does not satisfy these targets.

Fresh local checks October 24: 10 backend environment/cookie tests and 17 frontend
environment/auth-client tests passed. No build/deploy, actual proxy, browser,
cookie, DB, provider-console or restore check ran to draft this plan.

## 3. Provider evaluation and cost boundaries

Official sources checked October 24; recheck entitlements/terms in the actual
account before provisioning and before any commercial release. Prices/limits
are observations, not a purchase decision or guaranteed bill.

| Candidate                                                | Verified constraints                                                                                                                                                                                         | Proposed use                                                                                                                                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Render free web services for Next/Nest                   | Sleep after 15 idle minutes, shared 750 instance-hours/workspace/month; provider warns against production use. Free Render Postgres expires after 30 days.                                                   | Supervised non-sensitive/synthetic test candidate, not accepted live-store infrastructure. [Render free limits](https://render.com/docs/free)                                                                           |
| Neon Free PostgreSQL                                     | Pricing lists 100 CU-hours/month/project and 1 GB storage. Plan docs describe a limited six-hour history window capped by change-history allowance; actual recovery operations/entitlement must be verified. | Test candidate; no claim that a history window alone meets RPO/RTO or independent-backup requirements. [Pricing](https://neon.com/pricing), [plan limits](https://neon.com/docs/introduction/plans)                     |
| Paid Render or Railway compute with qualified PostgreSQL | Render paid quote/resources need account verification; Railway Hobby has a $5 minimum usage commitment, not a flat bill for the whole system.                                                                | Costed fallback if free resources cannot pass real-data gates; user budget approval required. [Render pricing](https://render.com/pricing), [Railway billing](https://docs.railway.com/pricing/understanding-your-bill) |
| Vercel Hobby                                             | Restricted to personal, non-commercial use. Free access for pilot customers does not itself establish permitted non-commercial use.                                                                          | Do not assume eligible for this SaaS; commercial plan/provider terms require explicit review. [Hobby restrictions](https://vercel.com/docs/plans/hobby)                                                                 |

Initial candidate: separate Next/Nest Node web services plus a separate Neon test
project, preserving current runtime architecture. Render supports full Next.js
server apps as web services; static hosting is not interchangeable with that.
[Render Next.js guidance](https://render.com/docs/deploy-nextjs-app)

This is a conditional evaluation path, not provider approval. Two always-running
free web services exceed the shared 750-hour monthly allowance. Wake delays,
build quotas, DB/egress limits, mail and backup scheduling costs matter even for
two organizations. Do not use artificial keep-awake traffic as a reliability plan.
Keep current pricing out of contractual uptime/recovery promises.

## 3A. Provider-agnostic implementation progress — October 25

The approved local slice now provides a fixed Next external rewrite from public
`/api/:path*` to a server-only origin-only `NEXT_API_UPSTREAM_URL`. The validator
rejects credentials, paths, query/hash tricks and non-HTTPS external upstreams in
production; direct mode remains available when the upstream is absent. The
frontend production launcher keeps the local 3001 default while honoring a host
`PORT`. Backend refresh-cookie issuance and clearing accept only `/auth` or
`/api/auth`, defaulting to the existing `/auth` path.

Focused config/cookie tests, full frontend tests, type checks, lint/format checks,
both builds and an elevated localhost proxy smoke check passed. The smoke check
confirmed path/query forwarding, incoming Cookie forwarding and preservation of
multiple Set-Cookie headers. Browser, provider-console, deployed-origin, ingress
identity, CSRF, cost, backup and real-data qualification remain open.

If free infrastructure cannot meet approved safety targets, keep hosted testing
synthetic and obtain a revised budget/provider decision before real transactions.
Do not silently relax targets or claim a periodic dump is equivalent to PITR.
04 owns the recovery proof; 05 must establish the actual provider capability and
cost of running it, including external encrypted backup storage/scheduling.

## 4. Confirmed same-origin browser/API topology

```text
Browser HTTPS origin
  ├── Next.js pages/assets
  └── /api/* → fixed configured NestJS upstream → runtime PostgreSQL connection
```

User confirmed this choice October 24. It avoids requiring an owned custom domain
solely for the browser/API relationship, not all infrastructure/email/domain costs.
Nest remains the authentication/business boundary; Next is not a new session store.

- Map public `/api/<path>` to fixed trusted upstream `/<path>` while preserving
  method, query, body, status and required headers. Start with built-in Next
  external rewrites if the installed runtime supports the full tested contract;
  add only a narrow handler if necessary, not an open/general-purpose proxy.
  [Next rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)
- No client-provided upstream/host/URL. Validate the configured HTTPS destination
  in hosted environments; prevent path/URL tricks from bypassing the fixed route.
- Keep the browser's absolute API base on its own origin with `/api`, compatible
  with the current validator. Upstream URL is server-only, never a secret-bearing
  NEXT_PUBLIC variable. Match a single slash boundary and preserve query encoding.
- Verify Cookie forwarding and every Set-Cookie header, including clearing.
  Do not expose HttpOnly refresh values to JS, drop multiple cookie headers or
  cache personalized/auth responses at a proxy/CDN/Next layer.
- Public refresh path must match `/api/auth/*`. Configure issuance **and clearing**
  consistently for that public path (for example `/api/auth`) while Nest keeps
  its internal `/auth/*` routes. Do not assume a rewrite changes Set-Cookie Path.
  [Cookie path semantics](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
- Keep production Secure/HttpOnly, host-only scope and SameSite=Lax unless a
  separately reviewed requirement changes them. Do not broaden Domain or switch
  to SameSite=None just to hide a topology bug. Define safe local HTTP settings
  and explicit old-path cookie cleanup during deployment cutover.
- Test login, refresh rotation, expired/revoked sessions, current-session removal,
  password change/reset, deletion and logout through the public origin. 03's
  immediate subsequent-request session rejection must work through the proxy too.

## 5. CORS, CSRF, proxy identity and failure safety

- Use exact allowlisted browser origin; do not enable wildcard credentialed CORS.
  Preserve server-facing health/release requests while verifying browser-auth
  mutations with a deliberate Origin/CSRF policy. CORS is not authorization or a
  complete CSRF defense, including login/refresh/logout. Plan the smallest valid
  Origin/token strategy for cookie-bearing routes and test cross-site submissions.
- Define the precise public ingress → Next → Nest forwarding chain. 03 implements
  trusted-hop/network checks using that evidence; never trust arbitrary X-Forwarded-
  For/Host/Proto, accept client-defined origin as deployment config, or collapse
  all browser clients into Next's single rate-limit identity.
- Test direct-to-Nest and forged-forwarded requests as well as the normal proxy.
  Public upstream visibility does not bypass auth/tenant guards; CSRF/origin checks
  must not be skipped merely because a request claims to be from the proxy.
- Define proxy body/header/timeout limits compatible with existing maximum
  checkout/refund commands. Proxy/network timeout is an unknown write outcome,
  not proof of rollback. Preserve safe errors/request IDs and 18 recovery.
- No automatic retries of POST/PATCH/DELETE at proxy or host level. Do not cache
  a replay response across users, drop request bodies on redirect, or convert
  errors into successful HTML. Use explicit same-command retry only.
- Validate trusted redirect/public links for invitations/reset/verification against
  configured frontend origin, not hostile Host headers; 07 owns mail workflows.
- Keep private logs, API docs and database credentials protected according to
  02–04. Token-bearing paths must be sanitized throughout proxy/host logs too.

## 6. Runtime/environment and rollout plan

1. Capture package roots, lockfiles, supported Node/package versions and current
   build artifacts. Use existing package scripts; do not upgrade dependencies to
   match a provider tutorial or remove lockfiles without a focused decision.
2. Define separate local/test/staging/pilot/production projects and secrets. Preview
   deployments must not inherit live API/DB/session secrets. Public build-time
   API origin values must match the environment; frontend secrets stay server-only.
3. Make frontend production start honor the assigned PORT without conflicting
   `-p 3001`; preserve local development behavior. Backend start uses 02's corrected
   artifact/PORT. Confirm host binding, resource limits and health-path routing.
4. Implement reviewed `/api` routing and cookie configuration with tests. Document
   internal versus external auth/health URLs and environment validation; no tenant
   schema changes. Align any new config fields with backend/frontend test schemas.
5. After user approves provider/limits and non-sensitive staging provisioning,
   deploy through 06 with 04 migration gates, never demo reset/seed or ambient DB
   URLs. Health probes consume 02 liveness/readiness; expose no DB diagnostics.
6. Run 03 ingress/session tests and 04 restore proof on the chosen environment.
   Measure cold/warm latency, memory, aggregate DB connections, quotas and costs
   with 12. Configure alerts/budget ceilings under 10, not a second monitoring stack.
7. Permit real pilot onboarding only after 07/08/09/18 and release gates pass.
   A successful homepage deployment is not readiness to accept store payments.

Public `/api` proxy is normal same-origin network routing, not permission to move
business logic into Next. Database/roles/schema remain owned by Nest/Prisma and
their relevant feature plans. No new package is expected; ask before additions.

## 7. Verification, acceptance and rollback

Extend existing frontend environment/auth-client and backend environment/cookie
tests. Capture actual browser headers rather than expecting fetch JS to read
Set-Cookie. Test in intended Chromium/WebKit/Firefox contexts where feasible and
separate unavailable browsers from passes.

Required proof:

- Production built processes start on allocated ports; exact installed runtime
  supports rewrite/header behavior. Unit mocks alone are insufficient.
- Through public `/api`, register/verify/login/refresh/logout/change/reset/delete
  and session revocation work; matching cookie issuance/clearing survives reload,
  multiple tabs and expiry without exposing refresh values or cookie duplicates.
- Off-origin/malicious Origin, forged forwarding headers, arbitrary-upstream/path
  attempts and direct Nest bypass do not defeat policies. Two real clients get
  intended independent rate identity; membership/tenant/branch denials persist.
- No auth/session response caching, cross-user replay, silent proxy retries or
  lost-response handling that creates duplicate sales/refunds/restocking.
- Cold compute/DB wake, exhaustion, deploy overlap and proxy timeout states are
  handled visibly without false success. Qualified backups/restore meet 15-minute/
  2-hour targets with operator validation; database free-tier labels are not proof.
- User accepts provider terms, measured cost ceiling, quotas, mail/backup costs,
  operational ownership and upgrade triggers before real use. No unapproved spend.

Run relevant unit/HTTP suites, full lint/typecheck/build and changed-file formatting
using installed tools. Full real-DB tests require independently verified disposable
targets. Record local, hosted, browser, restore and workload evidence separately;
never put credentials or private cookies in screenshots/logs.

Update `docs/modules/runtime-operations.md`, affected auth/config contracts and
deployment guides after implementation. 06 owns machine-readable host/release
manifests once the provider is approved; do not duplicate configuration here.

Rollback must keep public routes/cookie paths compatible or explicitly clear old
cookies and require safe reauthentication. Preserve 18's unresolved command data;
never solve a failed login cutover by deleting financial records or broadening
cookie/CORS trust. Restore prior compatible service/config, not an obsolete DB
snapshot after new live writes. Provider deletion/DNS changes need separate scope.

## 8. Open decisions and risks

Confirmed: same-origin `/api`; free-first limited testing; accepted RPO ≤15 minutes
and RTO ≤2 hours. Unconfirmed: provider/account entitlements, live-data budget,
backup location/retention/operator, region, measured runtime sizes and deployment
deadlines. No real hosted or restore proof exists yet.

Recommend evaluating Render/Neon for synthetic staging first, then presenting a
costed always-on/recoverable option if free resources fail gates. Do not assume
a published restore history guarantees recovery or that a cheap paid instance
has enough memory. Recheck official pricing/terms when deciding, not just this
dated source snapshot. If the budget stays zero and targets cannot be proven,
pause real-data launch instead of quietly accepting data-loss risk.
