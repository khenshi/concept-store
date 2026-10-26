# Outage and database recovery

This is the controlled-pilot response for a service, provider or database
incident. It is an operational procedure, not an uptime guarantee.

## Detect and classify

Run the read-only smoke check from the repository root:

```bash
OPS_API_URL=https://api.example.com \
OPS_FRONTEND_URL=https://app.example.com \
npm run ops:check
```

Interpret the result by layer:

- API liveness fails: the API process, host or route is unavailable.
- API readiness fails while liveness passes: the API is running but its database
  dependency is unavailable or the process is draining.
- Frontend fails while API checks pass: investigate the frontend deployment or
  same-origin proxy configuration.
- Same-origin proxy fails while direct API checks pass: investigate the frontend
  rewrite, origin configuration or cookie topology.
- All checks pass but a business request fails: preserve the command and inspect
  the authorized application error; do not classify it as a network rollback.

Record detection time, environment, release, check output and the last known
successful check. Do not include credentials, tokens, request bodies or payment
payloads in incident messages.

## Safe response

1. Pause new checkout and refund attempts while the affected dependency or
   outcome is unknown. Preserve existing unresolved attempts.
2. Do not run repeated migrations, reset a database, replay browser commands or
   restore an old database over newer writes.
3. For a bad deployment, stop promotion and restore the last compatible build
   using the release procedure. Verify migration compatibility before routing
   traffic.
4. For database failure or saturation, inspect provider state and connection
   limits, then restore service only after readiness and known-outcome checks pass.
5. For suspected tenant exposure, restrict affected access through approved
   controls and preserve minimal evidence. Do not perform broad deletion.

## Restore gate

Database recovery consumes the tested Plan 04 procedure and targets at most 15
minutes of recoverable-data loss and recovery within 2 hours, including
validation and reconnection. Restore to a separate target first, preserve the
old evidence, prevent split-brain writers, and verify memberships, sessions,
sales, refunds, stock and payment-account relationships.

If the restored point is missing a completed command, quarantine that attempt and
manually verify its outcome before any retry. A restored absence is not proof that
the original write never committed. Never automatically replay recovered browser
commands.

Resume traffic only after the operator records:

- restored target and migration compatibility result;
- measured recovery-point loss and recovery time;
- known checkout/refund outcome review;
- successful liveness, readiness, proxy and representative authorized smoke
  checks; and
- operator communication to affected stores.

No offline POS or automatic resynchronization is supported. A store-specific
manual fallback requires a separately approved policy before it is promised.
