# Plan 01 local regression recovery — October 25, 2026

Status: Plan 01 completed October 25. Source/local gates and all three affected
real PostgreSQL suites passed, including the explicitly enabled benchmark.

Base revision: `022d8e5`, initially clean worktree. Changes remain uncommitted.
Local tools: Node v26.8.1, npm 11.19.0, installed locked dependencies. This is
local verification, not a supported-host/runtime qualification under Plans 05/12.

## Scope and failure ledger

- Reproduced six obsolete frontend assertions: 71 passed/6 failed in six focused
  files. Replaced copy/DOM ancestry assumptions with behavior/accessibility proof.
- Reproduced 25 backend compiler diagnostics across six test files. Corrected
  partial request fixture typing, valid DTO inputs, duplicate expected keys,
  inventory enum values, direct-service pagination defaults, role mock inference,
  receipt DTO fixture and OpenAPI union narrowing. No production DTO/guard weakened.
- Reproduced inventory mocked HTTP defaults: 111 passed/2 failed. Updated only
  omitted-limit expectations to 15; explicit limit=10 cases remain unchanged.
- New-placement threshold starts at 5. Tests prove untouched default submission,
  explicit 0 opt-out, Enter-selected product ID/scope and stale selection rejection.
  Existing saved thresholds and backend numeric/stock rules are unchanged.
- Corrected merchant-branch OpenAPI fixed limit from 10 to 15. Added generated
  schema/response-reference regression coverage for both association list routes;
  runtime behavior unchanged.
- Branch hints remain absent as approved. Updated only conflicting module wording;
  labels, required values, validation and pending/cancel behavior remain intact.

## Executed checks

Commands use package working directories and existing tools, without installations.

| Check                                                  | Result                                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Frontend six-file focused command in current plan      | 79/79 passed after repairs                                                   |
| Frontend `npm test -- --run`                           | 1,154/1,154 passed, 116 files                                                |
| Frontend `npm run typecheck`                           | Passed                                                                       |
| Frontend `npm run lint`                                | Passed, four existing unused-symbol warnings in inventory-placement-form.tsx |
| Frontend `npm run build`                               | Passed; existing multiple-lockfile root warning retained                     |
| Final daily-table fixture consistency follow-up        | 7/7 tests passed; positive net fixture has matching gross/count/units        |
| Backend focused cookie/inventory/OpenAPI unit tests    | 31/31 passed, three suites                                                   |
| Backend focused inventory/access HTTP tests            | 125/125 passed, two suites                                                   |
| Backend `npm test -- --runInBand`                      | 539/539 passed, 41 suites                                                    |
| Backend `npm run test:e2e -- --runInBand`              | 264/264 passed, seven suites; mocked dependencies, not real DB integration   |
| Backend `npm exec -- tsc --noEmit --incremental false` | Passed; full test-source program included                                    |
| Backend `npm run lint` / `npm run build`               | Passed                                                                       |
| Backend `npm run prisma:validate`                      | Passed; schema/config syntax only, no DB contacted                           |

Changed-file formatting, local Markdown links and final diff whitespace are checked
separately at handoff. Frontend implementation/gates ran through one Standard agent;
parent inspected its diff and corrected/retested the daily fixture's consistency.
Backend repairs and documentation were performed by the parent. No escalation.

## PostgreSQL follow-up and exclusions

The initial Docker check was unavailable. Follow-up access required explicit
escalation. Created a fresh `postgres:17` container named
`concept-store-plan01-20261025`, bound only to localhost. Verified database
`concept_store_plan01_test`, user `postgres`, and zero application tables before
executing these suites:

- `test/inventory-pos-performance.integration-spec.ts` (also explicitly opt-in via
  `RUN_PERF_BENCHMARK=1`; a skipped run would not count as benchmark proof).
- `test/refund-command.integration-spec.ts`.
- `test/spaces.integration-spec.ts`.

Executed `npm run test:integration -- test/inventory-pos-performance.integration-spec.ts
test/refund-command.integration-spec.ts test/spaces.integration-spec.ts --silent`
with explicit disposable TEST_DATABASE_URL and RUN_PERF_BENCHMARK=1. Final result:
**72/72 tests passed, three suites, 20.583 seconds**, none skipped. Migration SQL
was applied only to isolated test schemas, which the harness cleaned up.

Real-DB runs exposed additional stale 10/50-row expectations in Spaces and the
benchmark directory/picker. Aligned them with the existing 15-row contract and
increased Spaces fixtures to preserve genuine second-page and filtered-total
coverage. No runtime pagination or financial behavior changed. Full backend
typechecking, lint and changed-file formatting passed after fixture repairs.

The run emits existing Node experimental VM-module and pg concurrent-client-query
deprecation warnings. Local benchmark completion does not prove hosted capacity.
Stopped/removed the temporary container and its disposable data after testing.
No application DB, demo reset, production migration, backup or deployment ran.
Browser/screen-reader/device/printing and startup/readiness/security/restore
qualification remain excluded/later-plan work.

No financial algorithm, authorization policy, request acceptance, schema, dependency
or infrastructure change was made. Full launch readiness is not established by
green local tests. Do not automatically advance to Plan 02 implementation.
