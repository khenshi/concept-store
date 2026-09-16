# Inventory/POS read measurements — September 16, 2026

This is a disposable-fixture comparison, not a production latency promise. Run
`RUN_PERF_BENCHMARK=1 TEST_DATABASE_URL=<explicit disposable PostgreSQL 17 URL>
npm run test:integration -- inventory-pos-performance.integration-spec --silent=false`
from `backend/`. The opt-in test creates and drops only its own random schema.
It seeds one tenant, one branch, 5,000 active products/placements across zero,
low and healthy stock, and 10,000 movements on one placement. Each service
timing is the median of five warm calls on the same local machine/container;
query count includes Prisma transaction and relation-loading statements.
`EXPLAIN (ANALYZE, BUFFERS)` samples are representative SQL shapes; service
timings include application mapping and JSON-ready response creation.

| Read | Baseline median | Queries/call | Returned/materialized |
| --- | ---: | ---: | --- |
| Inventory directory | 137.00 ms | 4 | 5,000 placements |
| Inventory LOW_STOCK filter | 139.98 ms | 4 | 5,000 loaded, ~1,667 returned |
| Health summary | 13.25 ms | 2 | 5,000 quantity/threshold pairs loaded |
| Movement history | 94.06 ms | 4 | 10,000 movements |
| POS search | 7.91 ms | 4 | 100 capped candidates |
| POS exact code | 1.67 ms | 4 | 1 candidate; deliberately uncapped |

Baseline plan highlights: the status-filter SQL has no stock predicate, scans
5,000 branch placements and sorts all 5,000 (3.05 ms execution, 257 shared
buffers); the summary scans all 5,000 (0.73 ms, 132 buffers). History scans
and sorts all 10,000 movement IDs (6.61 ms, 371 buffers) before Prisma loads
full rows. POS search scans products for an `ILIKE '%Item 049%'` term and caps
at 100 (2.31 ms, 258 buffers); exact code scans 5,000 products for an
SKU/barcode OR then performs one placement index lookup (0.46 ms, 128 buffers).
At this measured scale the POS service times are acceptable; adding a
speculative product index or changing exact-code ambiguity is not justified.

## After the scoped read changes

The same fixture and five-warm-call method was run twice after moving the
stock-status predicate into PostgreSQL, counting the three health categories
inside one repeatable-read transaction, and limiting history to 50 rows plus
one lookahead row. This is a contract change for history: clients request older
pages explicitly. The unfiltered directory and both POS paths were unchanged.

| Read | After medians (two runs) | Queries/call | Returned/materialized |
| --- | ---: | ---: | --- |
| Inventory directory | 131.77 / 127.14 ms | 4 | 5,000 placements |
| Inventory LOW_STOCK filter | 49.63 / 52.11 ms | 4 | 1,667 placements |
| Health summary | 6.67 / 6.49 ms | 5 | three counts, no placement rows |
| Movement first page | 2.24 / 5.06 ms | 4 | 50 movements |
| POS search | 7.86 / 7.59 ms | 4 | 100 capped candidates |
| POS exact code | 2.28 / 1.86 ms | 4 | 1 candidate; still uncapped |

The filtered-status sample now returns/sorts 1,667 rows rather than 5,000
(1.69 ms SQL execution, 257 shared buffers versus 3.05 ms baseline). A
representative LOW_STOCK count aggregates without returning rows (0.46 ms,
132 buffers). Each summary request runs three counts in one consistent snapshot;
its query count rises from 2 to 5 including transaction statements, while its
observed service median fell roughly in half and row materialization became
constant-sized. The first history page uses the existing
`InventoryMovement_history_idx` backward index scan (0.041 ms SQL execution,
53 buffers for 51 IDs versus 6.61 ms and 371 buffers for all 10,000). The
service-time samples vary with local runtime noise; the bounded row counts and
query plans are the primary evidence. No new index or POS change is warranted
by this fixture. Exact-code ambiguity remains intentionally uncapped.

The unfiltered Inventory directory still returns all matching placements
(127–132 ms for 5,000 rows). It is not a claimed improvement here. Its full
result is also used by the Add product placement picker to exclude already
placed products, so changing that endpoint to pages without redesigning that
consumer would silently offer duplicates. A separate reviewed directory/picker
pagination change is needed if larger branches make this read a practical
bottleneck. No unrelated Product-list or picker contract was changed here.
