# Operations

These runbooks describe the safe operator response for the controlled pilot.
They do not authorize direct database edits, automatic payment replay, offline
POS, or access to another organization's data.

- [Unknown checkout and refund outcomes](unknown-transaction-outcomes.md)
- [Outage and database recovery](outage-and-restore.md)
- [Manual completion checklist](plan10-manual-completion.md)

The read-only deployment smoke command checks API liveness/readiness, frontend
reachability and the same-origin API proxy:

```bash
OPS_API_URL=https://api.example.com \
OPS_FRONTEND_URL=https://app.example.com \
npm run ops:check
```

It never sends authenticated requests, mutates data, retries business commands,
or replaces provider monitoring and alert delivery.
