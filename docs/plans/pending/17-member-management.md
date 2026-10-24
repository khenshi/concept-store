# Plan 17: Directory pagination, member access history and POS browsing

Date: October 24, 2026

Status: Draft for review; planning only. No schema, API, UI, permissions, queries,
dependencies or database operations changed during this task.

Priority: All scope below required before real pilot, confirmed October 24.

## 1. Goal, decisions and boundaries

Bound directory responses, preserve all valid selector choices, record narrowly
scoped member access changes and let staff browse beyond the current POS cap.
Own the corresponding member/invitation/merchant/product/POS additions in the
[deployment checklist](../../deployment-readiness-checklist.md) and
[queue](README.md).

Confirmed October 24: all additions required before pilot; member access history
visible to Owners only; POS Load more returns 15 products per batch. Directory
tables also default to 15 rows, preserving shared pagination style and 1/N display.

Preserve current Owner-only membership/invitation management, last-Owner safeguards,
Merchant profile linkage, assigned-branch restrictions and reduced projections.
No new role, global audit platform, permission engine, cross-tenant directory,
offline catalog, editable financial history or new infrastructure. 07 owns email/
explicit acceptance/invitation permanent deletion; 18 owns durable command recovery.
Do not redesign current tables, member columns, action styles or dialogs.

## 2. Current source evidence and weaknesses

Reviewed membership service/controller and access dialog command paths; invitation
list service; merchant/product query DTOs and merchant service; POS DTO/service;
frontend list-consumer references and prior review records.

- Members return an array ordered by createdAt without pagination or stable ID
  tie-breaker. Invitation arrays sort createdAt descending then ID but lack bounded
  email/status/page queries.
- Merchant/product DTOs already define search/status (and product merchant) filters
  without page controls. Merchant lists feed Reports, product screens and merchant
  branch assignment, not just the directory. Updating only directory parsing would
  break consumers or silently truncate options.
- Membership changes use separate role/link, branch grant/revoke and removal
  operations with existing serializable/locking safeguards. A single UI dialog is
  not evidence of one atomic combined access-save command. History must reflect
  committed operations, not an imagined combined transaction.
- POS text browsing is capped at 100 results, sorted product name then inventory
  ID, without continuation. It includes disabled/out-of-stock participation rows
  with eligibility flags. Exact-code lookup follows an independent path.
- No application tests, real query/load, database or browser checks ran for this
  planning draft. None of these additions is certified implemented.

## 3. Directory API and query contracts

Evolve existing list endpoints and update all callers/runtime schemas/OpenAPI in
one coordinated approved change; prefer adding bounded directory/option endpoints
only where distinct projection/consumer needs justify them. Inventory consumers
before choosing exact routes. Do not preserve unbounded endpoints indefinitely
just to avoid migrating callers, or concatenate every page on every page load.

Common table contract:

```text
query: page (positive bounded integer, default 1), existing bounded filters
response: items, page, limit=15, total, totalPages, hasNext
```

Use the existing shared pagination convention for zero rows/out-of-range pages;
test it explicitly. Reject malformed/unknown query fields, oversized search,
unsupported status, invalid merchant IDs and unsafe numeric offsets. Fixed 15
is simplest; no arbitrary user-selected huge limit needed. Rows/counts share one
authorized filtered snapshot. Stable order always ends in a unique tie-breaker.

| Directory   | Search/filter and order                                                                                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Members     | Proposed bounded case-insensitive first/last name and email search; createdAt ascending, user ID tie-breaker. Owner-only. No password/session search or new role filter unless approved.                                      |
| Invitations | Case-insensitive email search, explicit status filter, createdAt descending/ID ascending. Owner-only; same current safe management projection.                                                                                |
| Merchants   | Preserve existing name/code/contact search only where actor projection permits it, plus status; name/ID order. Manager hidden contacts must not become search or total-count oracles.                                         |
| Products    | Preserve name/SKU case-insensitive and barcode case-sensitive search, merchant/status filters, name/ID order. Preserve affiliated-but-unplaced Manager product identity visibility; stock/prices remain assigned-branch-only. |

Invitation status is mutually exclusive using one request timestamp: ACCEPTED if
acceptedAt set, otherwise REVOKED if revokedAt set, otherwise EXPIRED if expiry
passed, otherwise PENDING. Apply the identical predicate to rows/count/filter.
Do not store a second mutable expiry status or count a row in multiple statuses.
After 07 permanent removal no row remains to paginate. Existing revoke action, if
retained, remains distinct from Remove. Public token preview is not a directory.

Filter/search changes reset page to 1. After create/edit/remove, requery the applied
scope; clamp/reload a now-empty final page without loops. Do not fabricate summary
totals by counting the visible page or fetch all data to restore old client sorting.
Retain query/draft state on retry; discard stale responses by scope/access generation.

## 4. Shared options and selection completeness

Map every list consumer: directory, product create/filter, member/invitation
merchant picker, merchant participation and Reports merchant filter, plus other
callers found during implementation. Use bounded server search/continuation with
minimal authorized option fields where necessary; do not leak directory contacts.
Selected ID lookup can retain a valid current choice not present in the first page,
but must reauthorize and apply the operation's eligibility rules.

Reuse existing custom dropdown/multi-select patterns. Loading/error/end states
remain local; do not drop selected IDs merely because a page changed, or accept
a stale choice that is no longer authorized. Never hard-cap choices at the first
15/100 or turn Reports filters into organization-wide identity discovery. Account
selectors (08) keep their separate availability contract. No general async-picker
framework unless repeated actual need justifies an approved extraction.

## 5. Narrow member access-change history

Add one tenant-owned access-event model, not a general audit log:

- Stable event ID, organizationId, occurredAt, operation category, actor identity,
  target user/membership identity and bounded structured before/after access state.
- Record committed role changes, merchant relink/unlink, branch grants/revocations
  and membership removal. Include implicit branch clearing caused by role changes
  in the same operation's before/after snapshot, not disconnected invented events.
- Minimize to role, branch IDs and merchant ID plus essential attribution. Avoid
  phone/email/password/token/financial payload collection. Decide safe display names
  after deletion with 13; do not copy personal names indefinitely without policy.
- Tenant-safe relations and indexes for organization/occurredAt/ID plus target
  lookup; target membership removal must not cascade its event history. Optional
  actor references/tombstones must not cross tenant boundaries or prevent legitimate
  account anonymization. 04 governs migration and 13 retention/redaction.

Pass the authenticated actor from trusted server context into each mutation; a
caller cannot select event actor/organization/time. Existing role/object checks
and last-Owner protection remain. Write before/after event in the same transaction
as access change. Rollback writes both or neither; no-op/idempotent grant/revoke
does not create a new change event. Failed attempts do not appear as successful
access changes. Serializable retry must not duplicate committed events.

History is Owner-only, read-only and server-paginated at 15 with stable newest-first
ordering. Proposed narrow route:

```text
GET /organizations/:organizationId/member-access-history?page=&userId=
```

Validate target within authorized tenant history even after removal; foreign/absent
references retain safe behavior. No public IDs grant history access. An organization
Owner can inspect removed targets' events without re-adding the member. Fresh role
checks prevent a demoted Owner retaining cached history. Do not expose events to
Managers merely because they manage a branch. Initial creation/invitation acceptance
and operator provisioning events stay with 07 unless explicitly added later; do not
pretend missing historical events can be reconstructed from current membership.

Add a contained Access history view in existing member management, preserving the
current member/invitation tables. Exact placement is a bounded implementation detail.
Keep each existing operation independently atomic; no combined bulk-edit API is
required. If a UI sequence partially succeeds, report actual committed steps and
reload state—never claim the whole dialog rolled back. 03's fresh membership checks
enforce changes; membership removal does not delete a global user/session in other
organizations. Tenant-inactive writes remain denied under 07.

## 6. POS bounded continuation

Return `{ items, nextCursor, hasMore }` with exactly up to 15 visible rows and one
extra fetched row only to derive continuation. Preserve current text search,
eligibility flags, minimal product fields and stable product-name/inventory-ID order.
Proposed keyset cursor encodes last sort key and inventory ID; validate bounded
shape and bind it to organization/branch/search/order. Cursor data never grants
access: reauthorize current user/branch and apply predicates on every request.
Use existing capabilities; encoding is not encryption or authorization.

Product names are mutable: keyset order across requests is not a frozen snapshot.
Deduplicate by inventory ID, reset/reload on scope/search/access change and allow
explicit refresh for updated catalog. No guarantee that concurrently renamed/new
rows appear once in a long browsing session; checkout revalidates current data.
If cursor key disappeared, handle safe continuation/reset explicitly, not fail open.

Keep exact-code scanner lookup independent of loaded pages and continuation; it
must find an authorized valid exact match beyond the current list without loading
all products. Preserve case/leading-zero/ambiguity behavior. Load more never adds
to cart, changes quantities/prices, bypasses inactive-branch restrictions (16), or
submits checkout. 18's unresolved commands remain frozen.

Reuse current list and a clear Load more action with local spinner/retry/end
feedback; no infinite scrolling or numbered POS table pagination required. Guard
duplicate requests/clicks, append only matching current-scope results and retain
already loaded items on continuation failure. Initial and continuation errors are
distinct; search stays editable. Do not announce out-of-stock as network failure.
No stock reservation, cache or whole-catalog browser persistence added.

## 7. Security, migration and delivery

All tenant queries include organization scope and existing role/branch/merchant
filters before count/search/order/limit. Cross-tenant guesses return existing safe
not-found/denial; status/count/search cannot leak hidden records. 03/07 verification,
session and active-tenant policy applies. 16 governs branch-specific writes, not
blanket removal of inactive history/options from authorized read contexts.

New schema is only scoped access history and measured necessary indexes. No backfill
of fabricated events; mark history available from cutover. Add forward migration,
validate/generate Prisma and rehearse under 04/06. Retention duration/redaction with
13 remains a pre-real-data gate, not default forever. Operator support events are
not duplicate member events. No destructive reset is authorized by this plan.

Implementation phases:

1. Inventory all list consumers and finalize API/option/status/history/cursor
   contracts; capture current role/last-Owner/selection tests.
2. Add paginated directory queries and migrate callers/runtime/OpenAPI together;
   preserve completeness of bounded option searches and selected identity lookup.
3. Add transactional access-event writes/read UI with Owner-only authorization.
4. Add 15-row POS continuation and local Load more states; preserve scanner/cart.
5. Test unit/HTTP and verified disposable PostgreSQL: >30 rows, ties, empty/late
   pages, concurrent mutation, invitation expiry boundary, acceptance/removal,
   filtered totals, hidden contact search, Merchant scopes and foreign IDs.
6. Race access mutations and last-Owner removals, inject event-write failure and
   prove rollback/no-op behavior; retain events after target membership removal
   and ensure account deletion/redaction follows approved policy.
7. Test repeated/forged/stale cursor, search changes, renamed rows, access revoke,
   duplicate appends, scanner beyond first page, disabled rows and unchanged cart.
   12 measures query counts/budgets, 11 actual keyboard/mobile/loading behavior.
8. Run format/lint, app/test-source typing, Prisma checks, relevant full unit/HTTP/
   integration and builds. Deep review covers new attribution/history security and
   concurrency. Update memberships/invitations/merchant/product/POS/frontend module
   docs after delivery; 14 requires this scope before pilot.

## 8. Rollback, completion and open gates

Coordinate array-to-page API/client deployment; do not let an older caller treat
one page as a complete list. Rollback only compatible clients/contracts and retain
committed access events. Do not cascade-delete history, expose broader options or
restore unbounded queries to conceal failures. Stop affected writes if mandatory
event persistence cannot be trusted; use approved operations procedure, not new
global maintenance behavior.

Complete when all directories return correct scoped 15-row pages/counts, every
selection remains complete through bounded search, committed access changes have
minimal atomic Owner-only history, and POS loads 15 at a time without affecting
scanner/cart/checkout safety. Evidence must cover current candidate, not old counts.

Remaining gates: history retention/deletion display policy, exact option consumers
and routes, cursor encoding/version limits and contract rollout. Proposed member
search fields and contained history placement need review before coding. The
confirmed pre-pilot priority and Owner-only history access are not open decisions.
