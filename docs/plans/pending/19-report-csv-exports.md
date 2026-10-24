# Plan 19: Scoped Sales Reports CSV exports

Date: October 24, 2026

Status: Draft for review; planning only. No export, API, download, dependency,
application or database change performed.

Priority: Optional after pilot, confirmed October 24. Not a pilot blocker. Plan
13's tested manual tenant-scoped handover remains independently required.

## 1. Goal and boundaries

Export complete matching Transactions, Daily Data and Rankings for the applied
period, filters, ordering and authorized single/all-branch scope. Own the optional
CSV addition in the [deployment checklist](../../deployment-readiness-checklist.md)
and [queue](README.md). Export is read-only; not a new financial source.

Owners and Managers receive only existing authorized staff reporting fields;
Merchants only own-item rows/columns. Cashiers remain denied. Reuse 08 account and
09 scope contracts, report predicates/calculations and shared action styles.

Exclude XLSX/PDF reports, email delivery, saved export files, queues/jobs, scheduled
reports, public share links, imports, full tenant backups and new finance logic.
No separate export datastore, generic framework or new package by default. No
whole-history browser fetch or scraping rendered/paginated tables.

## 2. Current evidence

Reviewed report query DTOs, staff/Merchant response types, report service transaction
inventory and frontend export/download file inventory, plus previous review scope.

- Transactions support type/reference search and pagination; Daily uses applied
  bounds and paginated dates; Rankings has sort and staff merchant filter. Existing
  staff/Merchant schemas deliberately differ.
- Reports use repeatable-read transactions for scoped queries. Current paginated
  read functions cannot be looped over separate HTTP requests and described as one
  consistent export. Reuse their underlying authorized queries instead.
- Staff transactions expose actor/payment context while Merchant rows omit it.
  Never build a staff CSV then hide columns only in the client.
- No dedicated Reports CSV/download implementation was found in the inspected
  frontend inventory. External scripts are unverified, not assumed absent.
- No fresh tests, actual CSV, database, browser/spreadsheet or performance checks
  ran for this planning draft. Fixed-method schemas migrate separately under 08.

## 3. Proposed API and consistency

Add thin report export endpoints beside the existing branch and 09 aggregate
routes, reusing the same validated scope resolver and report service seams.
Proposed branch examples:

```text
GET /organizations/:org/branches/:branch/reports/transactions/export.csv
GET /organizations/:org/branches/:branch/reports/sales/daily/export.csv
GET /organizations/:org/branches/:branch/reports/sales/rankings/export.csv
```

Add equivalent aggregate endpoints under 09's report routes; finalize naming
against existing controller paths before coding. Use dedicated strict export DTOs
with the same applicable bounds/search/type/merchant/sort rules, not inherited
page/limit that silently limits output. Unknown paging parameters should reject
or be explicitly excluded by the contract, never pretend a page is a full export.
Do not export unapplied date-picker drafts.

Reauthenticate and resolve current verified identity, membership, role, tenant,
branch/merchant predicates for each request. Organization inactivity permits the
authorized historical read under 07; branch inactivity does not remove history.
Export uses exactly those predicates before count/group/sort, including period
earliest activity and filter validation. No caller-supplied list expands branches.

One bounded repeatable-read transaction obtains count/rows/metadata and serializes
against that consistent snapshot. A later export may include newer commits; this
does not freeze other tabs. If authorization changes after the request snapshot,
normal request-snapshot semantics apply—do not claim immediate revocation of bytes
already downloaded. Short time limits and fresh checks before delivery minimize
exposure; no queued artifact survives with stale permissions.

Read all matching rows within a measured cap; use one bounded query or stable
chunked SQL inside the same bounded transaction if needed, not unbounded memory
or a long-lived browser-driven transaction. Preflight cap and final payload bounds
inside the same snapshot. Never silently truncate or emit a successful partial CSV.

## 4. Row semantics and exact values

| Export       | Columns/behavior                                                                                                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Transactions | Source type/code/IDs, completion time, real branch identity and permitted amount. Staff may include existing saved actor/account labels; Merchant amount is own-only and omits staff payment/actor/other-merchant data. Refund follows its own completion/account. |
| Daily Data   | Manila calendar date and existing scoped count/units/gross/refund/net metrics; Merchant uses own metrics only. Preserve zero-day filling and exact clipped interval rules, not analytics monthly/yearly chart buckets.                                             |
| Rankings     | Global rank, stable product identity/saved label and existing allowed SKU/barcode/merchant and sales/refund/net metrics for the applied sort/filter. Aggregate product before rank; export beyond UI top-N/page 15.                                                |

Finalize exact ordered column manifest from current 08/09 report projections;
do not add payment references, private commands, contacts or costs merely because
an export could query them. Empty result has valid metadata/header and no invented
source rows. Dates/time zones and amount sign conventions are explicit: transaction
sale inflow positive/refund outflow negative in a documented signed amount column;
Received/Refunded magnitudes stay nonnegative and Net signed as existing metrics.
Do not negate already-signed amounts twice or reconstruct totals from UI strings.

Money is exact two-decimal text from authoritative decimal calculations, no PHP
prefix, thousands separators or binary floating-point recomputation. Counts/IDs
and timestamps preserve exact textual representation. Label currency PHP in the
column manifest/metadata. Include report type, safe organization/scope label,
inclusive/exclusive UTC bounds, Manila date interpretation, applied filters/order,
generation time and schema version. Metadata layout must remain parseable—prefer
consistent leading metadata records plus one documented table header, not arbitrary
comment rows that a parser mistakes for transactions. Choose/test the final layout
before coding; no multi-file archive required.

CSV has no reliable universal cell-type declaration. Preserve leading-zero SKU/
barcode values in the serialized data and document importing identifier columns
as text; do not create `="00123"` formulas or promise double-click auto-detection
will preserve them. If strict spreadsheet typing is later required, propose a
separate typed-file feature, not silently add an XLSX dependency here.

## 5. CSV and spreadsheet safety

Serialize UTF-8 with deliberate BOM policy tested against the supported import
tool. Escape delimiters, quotes and line endings consistently; embedded quotes
are doubled within correctly quoted fields. Test Unicode, commas, semicolons,
quotes, multiline data and malicious attempts to break into another cell.

Quoting is not formula protection. Apply a reviewed spreadsheet-safe policy to
every untrusted text field including names/codes/metadata, covering formula-like
prefixes, control whitespace and locale variants. Keep trusted server-generated
negative money numeric: do not prefix legitimate negative net values as malicious
text. Preserve raw source values in the database; document any protective export
prefix that changes the serialized text. No raw unsafe export mode by default.

OWASP warns that spreadsheet mitigation behavior varies and save/reopen can undo
some escaping. Select and verify the intended spreadsheet import workflow before
implementation; do not claim universal safety or universal lossless auto-open.
[OWASP CSV Injection](https://github.com/OWASP/www-community/blob/master/pages/attacks/CSV_Injection.md),
[OWASP testing guide](https://owasp.github.io/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Injection/21-CSV_Injection).

Test harmless payloads for dangerous-prefix cells and save/reopen in the declared
spreadsheet/browser tools. No external exfiltration formulas or real data in QA.
Failure to establish a safe supported workflow blocks this optional feature.

## 6. Runtime, privacy and frontend download

Start with synchronous, bounded output. Proposed provisional maximum 10,000 data
rows per request plus explicit encoded-byte and time budgets, subject to 12's
measured host/memory/proxy limits and user review. Daily long/All Time exports
can exceed the cap too. Oversize returns a typed actionable error before download,
asking for narrower dates/filters; never truncate at 10,000 or silently change
the applied scope. Count after aggregation, not sale item join multiplication.

Bound concurrent exports per actor/tenant, apply existing abuse controls and test
shared-NAT behavior. No report request may starve checkout/pools. Abort/cancel
must clean work/response buffers; closing a download is not a financial mutation.
No stored artifacts or request bodies/references in logs; sanitized duration/count/
error evidence only. Return private no-store caching, safe text/csv attachment
headers and generated filename without raw untrusted header content.

Frontend uses one Export CSV action per supported tab, not a new page or date
picker. Shows applied scope and all-matching-rows meaning, with pending/disabled
state and explicit cap/request errors. Download through authenticated API path
and 05 proxy, not a bearer token in a URL. Handle non-CSV JSON errors correctly;
do not save an error page as CSV. Revoke temporary object URLs after use. Scope/
user changes prevent stale payload download; failed requests preserve filters.
No optimistic 'export successful' before valid content arrives, no automatic retry
storm, and keyboard/live feedback follows existing patterns and 11.

13 governs private handling of downloaded files and data-subject requests; display
a concise warning that the file contains scoped business data. Once downloaded,
server revocation cannot recall the file. This optional export is not a replacement
for 13's tested manual data handover or a raw full-tenant backup.

## 7. Delivery phases and verification

1. Agree exact role-aware column/metadata/sign manifest, cap/byte/time limits and
   supported spreadsheet import/safety policy. Baseline current report predicates.
2. Extract only narrow reusable scoped query/serialization seams. Implement strict
   branch/all endpoints and defensive output; no duplicate financial math.
3. Add existing-style authenticated download actions and local pending/error states.
4. Unit/HTTP tests: all roles, foreign scope, Merchant relink/unlink/hidden fields,
   malformed ranges/filters, empty results, JSON errors and attachment/cache headers.
5. Verified disposable PostgreSQL: >15 rows, tied timestamps/ranks, shared products/
   accounts, partial/different-date refunds, refund-only/negative periods, zero-filled
   dates and All Branches. Compare full exported values/totals to ground-truth
   scoped SQL and existing report calculations within the same fixture snapshot.
6. Test concurrent source writes, count/cap boundary and one-row-over-cap, byte/time
   failure without partial-success output, pool budgets and cancellation under 12.
7. Test CSV parsing/round-trip Unicode/newlines/identifiers and spreadsheet formula
   handling/import/save/reopen. Browser keyboard/mobile downloads and stale scope
   response controls require actual 11-style evidence, not DOM tests alone.
8. Run formatting/lint, app/test-source checks, unit/HTTP/integration/builds through
   06; review security/financial projection changes deeply. No migration expected
   unless measured query evidence justifies an approved 04 index change.

Update reports/frontend module docs and export instructions after implementation;
record cap, encoding/manifest version and supported import workflow. Rollback may
remove export actions/endpoints without changing report records/queries or Payment
Account schema. Never delete source data to fix output; no artifacts need migration.

## 8. Acceptance and open gates

Complete when full matching scoped results—not just visible pages—export accurately
within explicit bounds, Merchant output is own-only, dangerous text is handled
under the tested supported workflow and failures never present truncated data as
success. Optional after pilot; 14 records inclusion or deferral explicitly.

Open: column/metadata layout, spreadsheet/import support and formula policy,
row/byte/time/concurrency budgets and approved implementation timing. No new
financial feature, document format, queue or infrastructure is authorized by this
draft. Plan 13 handover remains a separate required launch gate.
