# Plan 10 manual completion checklist

Status: Completed by user confirmation on October 26, 2026. Provider dashboard,
alert and restore evidence remains outside the repository; no credentials or
private operational data are recorded here.

This checklist is for the deployed Vercel frontend, Render API, Neon database
and Resend account. Complete it outside Git, then record the evidence in the
Plan 10 validation file. Do not place credentials, tokens or private customer
data in the repository.

## 1. Confirm deployment targets

- [x] Record the production frontend URL and Render API URL.
- [x] Confirm Vercel uses the intended same-origin `/api` proxy and Render is the
      fixed upstream.
- [x] Confirm the deployed API has the matching migration state before enabling
      real pilot writes.
- [x] Run the read-only smoke check from a trusted machine:

  ```bash
  OPS_API_URL=https://your-render-api \
  OPS_FRONTEND_URL=https://your-vercel-app \
  npm run ops:check
  ```

- [x] Save the date, release identifier and output. A failed check must block
      pilot use until the affected layer is understood.

## 2. Configure monitoring and alerts

Use provider-native dashboards where they are sufficient, plus one independent
uptime check if available. Configure an alert owner and runbook link for each:

- [x] Vercel frontend reachability and deployment failures.
- [x] Render `/health/live` and `/health/ready`.
- [x] Vercel same-origin `/api/health/live`.
- [x] Render 5xx rate, latency, restarts, memory/CPU and connection pressure.
- [x] Neon storage, compute, connection and bandwidth/quota warnings.
- [x] Backup freshness and backup failures.
- [x] Resend rejection, delivery failure and quota warnings.

Use the proposed starting policy unless measured provider behavior requires a
documented change: one-minute checks, alert after two consecutive failures, and a
recovery notification after sustained success. The alert channel must remain
usable if the application or Resend is unavailable. If there is no fallback,
record that limitation explicitly.

## 3. Name support coverage

- [x] Record the primary pilot operator: the project owner.
- [x] Record the exact store support channel.
- [x] Record support hours and expected response time.
- [x] Record a fallback contact, or explicitly record that there is no fallback.
- [x] Confirm stores understand that there is no 24/7 promise and no offline POS.

## 4. Configure and rehearse backups

- [x] Configure a recoverable backup point at least every 15 minutes, or document
      an approved limitation before pilot use.
- [x] Configure retention and least-privilege backup access.
- [x] Configure backup-age and backup-failure alerts.
- [x] Restore to a separate disposable Neon target; do not reset the live database.
- [x] Measure the recovery-point loss and recovery time. The target is at most
      15 minutes of data loss and recovery within 2 hours.
- [x] Verify restored memberships, sessions, sales, refunds, stock movements and
      Payment Account relationships.
- [x] Verify the matching API can reconnect and pass readiness after restore.
- [x] Preserve the old target and drill evidence until the result is reviewed.

## 5. Run isolated failure drills

Use staging, disposable targets or provider test controls. Do not take a live
store offline just to create an alert.

- [x] Frontend/proxy/API failure is detected and routed to the right operator.
- [x] Database readiness failure is detected while liveness remains distinct.
- [x] 5xx/latency and quota warnings are detected without paging on normal 4xx
      validation or authorization responses.
- [x] Backup failure/age breach produces an actionable alert.
- [x] Resend failure or quota breach produces an actionable alert without bypassing
      verification or password recovery controls.
- [x] Alert delivery, acknowledgement, deduplication and recovery notification
      are all observed.
- [x] Unknown checkout/refund handling is rehearsed using the runbooks, with no
      duplicate sale, refund, payout or restock.

For every drill record detection time, delivery time, acknowledgement, mitigation,
verification, closure, release/environment and any failure. Do not record real
payment references or credentials.

## 6. Completion evidence

Plan 10 can be archived after the evidence shows:

- [x] Deployed smoke check passed.
- [x] Required alert checks and notification path passed.
- [x] Support owner, channel and coverage are recorded.
- [x] Backup/restore drill met the RPO/RTO target or has an explicitly approved
      pilot exception.
- [x] Incident runbooks were exercised and any failures resolved.
- [x] Remaining risk is documented, including the separate Plan 18 dependency for
      durable checkout/refund outcome recovery.

The user confirmed the checklist and external evidence on October 26, 2026.
The validation record preserves that confirmation without storing provider
credentials or private operational data.
