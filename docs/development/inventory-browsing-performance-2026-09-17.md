# Bounded Inventory browsing measurement — September 17, 2026

This is a disposable PostgreSQL 17 fixture comparison, not a production
latency guarantee. The opt-in test in
`backend/test/inventory-pos-performance.integration-spec.ts` creates and drops
only its random schema. Run from `backend/` with
`RUN_PERF_BENCHMARK=1 TEST_DATABASE_URL=<explicit disposable PostgreSQL URL>
npm run test:integration -- inventory-pos-performance.integration-spec --silent=false`.
It seeds the same 5,000 active product placements, one branch/tenant, and
10,000 movements used in the [September 16 baseline](inventory-pos-performance-2026-09-16.md).
Medians are five warm service calls per run; two runs were recorded.

| Inventory read | Previous unbounded median | Bounded medians | Returned to application |
| --- | ---: | ---: | ---: |
| Unfiltered directory / first page | 127.14–131.77 ms | 9.33 / 8.85 ms | 50 placements + one lookahead |
| Unfiltered directory / next page | Not available | 5.67 / 5.89 ms | 50 placements + one lookahead |
| LOW_STOCK directory / first page | 49.63–52.11 ms | 7.28 / 7.76 ms | 50 placements + one lookahead |

The first page uses four Prisma statements, including relation loads; a next
page uses one additional cursor-existence check. The representative first-page
SQL plan scans 5,000 placement/product rows, but uses a 51-row top-N sort
(28 kB) and returns only 51 IDs from its limit node: 2.43 ms execution and
257 shared buffers in the first run. The stock-filtered page scans the 1,667
matching placements and returns 51 IDs: 1.53 ms and 257 buffers. These plans
show bounded rows returned to the service, not constant database work. A new
index was not justified by this fixture: the observed query execution is
about 1.5–2.5 ms, while the pagination contract removes the large response
and application mapping cost. Larger production data should be remeasured.

After the baseline actions, the fixture adds 100 active *unplaced* products to
measure the new picker without altering the directory comparison. Its first
page returned 50 candidates plus lookahead in 3.18 / 3.15 ms (two Prisma
statements per call). The representative anti-join plan scans 5,100 products
and 5,000 placements, returning 51 candidate IDs in 1.97 ms with 261 shared
buffers. The client no longer downloads the full 5,000-placement directory or
an unbounded Product list to build placement choices. The create-placement
conflict remains authoritative under concurrent placement.

The summary, movement, and POS service medians remained near the September 16
measurements and were not changed by this work. No schema/index migration or
POS query change was made.
