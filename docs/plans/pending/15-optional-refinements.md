# Plan 15: Optional interface and documentation refinements

Date: October 24, 2026

Status: Draft for review; planning only. No current-behavior docs or application
code changed by drafting this plan. Implementation remains separately approved.

Priority: P2, explicitly nonblocking for pilot and paid launch. Critical safety,
accessibility or user-task failures belong to their required owner, not this bucket.

## 1. Goal and exclusions

Make module references coherent and optionally address demonstrated minor interface
inconsistencies without changing product behavior or authored design. Own the
optional documentation/interface cleanup items in the
[deployment checklist](../../deployment-readiness-checklist.md), §5/7, as mapped
in the [planning queue](README.md).

Use current source/tests as evidence, not outdated prose as authority to rebuild
removed behavior. No schema, API, permission, lifecycle, pagination, validation,
preference-persistence or financial behavior changes. No new themes/dependencies,
table/modal framework, global styling rewrite or feature expansion.

01 owns failing test contracts and approved placement threshold changes; 03/07
security/onboarding; 08/09 payments/report scope; 11 route recovery, confirmation
guidance, account-deletion action design and accessibility blockers; 16–20 their
approved features/privacy. Do not quietly implement those through documentation.

## 2. Review evidence and source authority

Inspected module-review records, `docs/README.md`, affected module descriptions,
Sales list DTO/tests and current component path inventory. Fresh evidence confirms
Sales query default 15 while older docs state 50, and merchant-profile docs contain
both compact and wide creation-dialog wording. Other discrepancies below are
recorded October 23 findings requiring source revalidation at implementation.

No new application tests, browser, database or builds ran for this draft. Historical
test totals/waivers remain dated context, not current acceptance. This plan does
not establish that every listed discrepancy is still present after intervening work.

## 3. Bounded cleanup inventory

| Current-behavior reference | Required correction, preserving behavior                                                                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organizations              | Retain chooser cards and in-memory Reports-period persistence; remove contradictory row-only/no-persistence descriptions where outdated. Shared real branch preference is a separate existing contract.               |
| Merchant profiles          | Resolve compact/wide creation-modal contradiction against the current standard dialog. Do not change modal size or lifecycle rules.                                                                                   |
| Products                   | Correct placement-only Manager visibility: affiliation-based eligible product identity includes unplaced products; stock/price reads remain assigned-branch-only and identity management Owner-only.                  |
| Branch inventory           | Correct eligible-product scope/default 15, integrity Previous/Next pagination and removed discard prompts. Do not restore Load more/discard dialogs or change existing saved thresholds.                              |
| POS                        | Document current fullscreen branch name beside POS and exit action, with branch selector/Cart/History navigation hidden. Planned Load more and durable recovery stay unimplemented until their owners deliver them.   |
| Sales                      | Correct obsolete default 50 to current 15, preserve immutable source snapshots and refund-based corrections; no sale edit/delete feature.                                                                             |
| Refunds                    | Remove obsolete forms-as-future-work and incorrect Reports navigation descriptions; retain in-place refund detail modal and actual route/permission behavior.                                                         |
| Reports                    | Replace summary-only/obsolete date restriction descriptions with current analytics, nested tabs, presets/All Time and bounded long-history pagination. Payment Accounts/All Branches remain proposed until delivered. |
| Spaces                     | Correct outdated initial input focus/layout/row-style descriptions against current heading focus and compact forms/columns; do not change actor visibility as a docs-only fix (20 owns privacy).                      |
| Frontend experience        | Consolidate current shared tables/dialogs/loading/feedback, remove contradictory five-row defaults and superseded layouts from current contracts, retaining historical delivery evidence separately.                  |
| Docs index                 | Keep current modules, pending proposals, development guides and dated validation evidence distinct; do not call a pending feature implemented because its plan exists.                                                |

Recheck exact paths through `frontend/src/features/` and backend DTO/services/tests
before each correction. Name concrete routes, allowed roles and source defaults
where helpful. When code and an approved behavior disagree materially, report it
to the owning plan rather than making code/prose agree by assumption.

## 4. Historical evidence handling

Maintain one clear current contract per module; relocate long superseded delivery
chronologies to existing validation/archive locations only where useful. Preserve
dates, failures, waiver scopes and provenance with links. Do not delete unfavorable
test results, overwrite archived plans as current authority or renumber the queue.
Old waived browser/print checks cannot be recast as passed release evidence.

When 07/08/09/16–20 subsequently ship, their owners update the relevant module
documents. This plan must not publish their proposed API/model/state as implemented
or duplicate their migration/rollback specifications. Avoid unnecessary document
splitting or a new documentation-generation system.

## 5. Optional interface follow-ups and triage

No broad visual edits are pre-approved here. A minor, reproducible spacing/copy/
nonessential consistency finding may be proposed with exact component, incumbent
reference, preserved behavior and bounded diff. Reuse existing tokens/components.
Any future interface edit must follow DESIGN.md and the relevant frontend skill,
with scoped desktop/mobile confirmation—not a redesign opportunity.

Route findings by impact:

- Tenant leak, money/stock/recovery error or unsafe command behavior: block affected
  release through responsible security/financial plan and 14.
- Keyboard trap, inaccessible essential action, hidden required field, broken route
  recovery or unusable checkout/PDF: 11, not optional deferred polish.
- Measured pagination/performance or query issue: 12/17 and responsible feature.
- Current operator instructions that could cause a destructive action: correct
  under 04/06/10 before use; optional classification cannot excuse unsafe runbooks.
- Purely cosmetic preference or historical prose cleanup: P2 here; explicit
  deferral is acceptable and does not change safety gate status.

The known multiple-lockfile build warning may be investigated here only if still
present: inspect intended monorepo roots and installed framework config first.
Do not remove either application's required lockfile, merge package managers or
add configuration blindly to silence a warning. Any runtime/build behavior change
needs a bounded approved scope and proof under 06.

## 6. Phases and verification

1. Select a small approved documentation batch; revalidate each finding against
   current implementation and owning plan. Preserve unrelated worktree edits.
2. Correct current contract wording and link dated historical evidence rather than
   erasing it. Do not change application tests merely to endorse wrong prose.
3. Validate formatting, local links/anchors, referenced paths and contradictory
   defaults/roles/routes. Review final diff for accidental scope/authority changes.
   Pure documentation needs no app/database run, but disclose that limitation.
4. If separately approved UI/build edits occur, run relevant typecheck/lint/tests/
   build and bounded real browser verification, preserving behavior. Do not introduce
   packages or infrastructure to implement optional polish without approval.
5. Update the checklist evidence only for actual corrected docs/verified refinements.
   Archive only completed approved scope; record deferred work as optional, not done.

Rollback prose to accurate source-backed wording, not superseded incorrect claims.
UI rollback preserves compatibility, access and 18's unresolved command state;
no data reset or migration is involved. Test/build failures belong to their owner,
not permission to weaken a test to finish documentation cleanup.

## 7. Completion and remaining decisions

Complete the selected optional batch when current references match verified behavior,
historical evidence is retained/linkable and no excluded behavior changed. It is
valid to defer all P2 refinements at release sign-off. No new business question is
needed for this classification; exact batches and any real UI edits need approval.
Plans 16–20 and final batch dependency review remain outstanding after this draft.
