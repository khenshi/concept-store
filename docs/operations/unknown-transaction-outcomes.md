# Unknown checkout and refund outcomes

Use this procedure when checkout or refund loses its response, shows an
unavailable/error state, or cannot immediately show the saved result.

## Immediate response

1. Stop repeat collection, payout and restocking for the same customer action.
2. Preserve the original frozen command and request ID. Do not refresh away an
   unresolved attempt, change its account/items/amount, or create a replacement
   command from memory.
3. Reauthenticate if needed and use the existing authorized saved-sale or refund
   history. A missing screen, timeout or 404 is not proof that the write rolled
   back.
4. If the saved result is found, verify the actual sale/refund, total, payment
   account, branch and stock effect. Reprinting a saved receipt is safe; printing
   never repeats checkout.

## Resolution

| Evidence | Action |
| --- | --- |
| Completed sale/refund and matching stock effect | Acknowledge the saved result and do not retry. |
| Pending/unknown command | Keep the command blocked and use the durable recovery workflow when Plan 18 is available. |
| No result after an authorized read | Escalate for operator verification; do not infer rollback and do not insert a replacement record. |
| External money may have moved but the application result is unknown | Do not collect or refund again. Record the uncertainty and escalate. |
| Explicit same-command retry is offered by the recovery workflow | Retry only unchanged content after fresh authorization and idempotency checks. |

Refunds require separate confirmation that the application refund record and the
actual payout are both understood. Partial and multiple refunds must be checked
against the saved sale, returned quantities, restock result and actual payout
account. Never duplicate a refund or restock to resolve uncertainty.

## Escalation record

The pilot operator is the project owner. The exact support channel and coverage
window must be configured before pilot use; no 24/7 response is promised. Share
only the minimum needed:

- environment and release identifier;
- organization and branch, after verifying the staff actor;
- approximate time and timezone;
- original request/source identifier, if available; and
- the observed state and authorized history result.

Never request passwords, cookies, access tokens, payment secrets or full customer
or item payloads. Operators must not use direct SQL inserts/deletes or stock edits
to conceal an uncertain outcome.
