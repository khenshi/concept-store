---
target: Sales Reports page
total_score: 25
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 3
target_identity: "file:/Users/khenshi/Documents/code/concept-store/frontend/src/features/reports/components/branch-reports.tsx"
target_fingerprint: "sha256:8b206468188325bd41eea031908ba305ac353c1449d114af0e1fd5b2a078ff98"
target_path: /Users/khenshi/Documents/code/concept-store/frontend/src/features/reports/components/branch-reports.tsx
timestamp: 2026-09-30T06-07-18Z
slug: res-reports-components-branch-reports-tsx-ad015a28
---
## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | Active tab, period, branch, loading, and empty states are visible; refresh and chart-loading context are easy to lose once the page is scrolled. |
| 2 | Match System / Real World | 3/4 | Philippine time, branch scope, refunds, and merchant language fit the store context; terms such as “net recorded sales” and “saved sale identity” are still accounting-system language. |
| 3 | User Control and Freedom | 3/4 | Users can change period, branch, tab, rank metric, merchant, and refresh; there is no persistent context bar or quick reset path. |
| 4 | Consistency and Standards | 3/4 | Controls, borders, typography, and tabs follow Kapwesto’s operational system; terminology and spacing vary between staff and merchant report variants. |
| 5 | Error Prevention | 3/4 | Date validation, role-scoped merchant options, and explicit Apply/Refresh actions prevent common mistakes; the disabled merchant selector gives little explanation while options load. |
| 6 | Recognition Rather Than Recall | 2/4 | Labels are understandable in isolation, but users must remember the difference between gross, refunded, net, and own values while moving between tabs and charts. |
| 7 | Flexibility and Efficiency | 2/4 | Ranking sort/filter controls help; long reports require repeated scrolling and ten-row pagination, with no sticky report context or compact period shortcuts. |
| 8 | Aesthetic and Minimalist Design | 2/4 | The neutral visual language is coherent, but zero-value charts, an empty donut, and repeated explanatory copy spend too much space without adding insight. |
| 9 | Error Recovery | 2/4 | Retry actions exist for report and ranking requests; recovery is visually separated from the controls, and stale successful data is not retained while a refresh fails. |
| 10 | Help and Documentation | 2/4 | Inline descriptions are thoughtful; key metric definitions, data freshness, and the meaning of refund/net relationships are not available at the moment of decision. |
| **Total** | | **25/40** | **Needs focused refinement** |

## Design Specificity Verdict

### LLM assessment

The page is authored for Kapwesto in its branch scope, Philippine-time framing, merchant privacy model, and restrained operational visual system. The report’s role-aware language is a real product-specific strength.

The composition is still largely category-interchangeable: KPI strip, line chart, bar lists, weekday bars, payment donut, then a dense ranking table. An unrelated admin dashboard could reuse the same structure unchanged. The missed opportunity is to make the page feel like a store operator’s decision surface: what happened in this branch, what changed because of refunds, and which merchant/product needs attention next.

### Deterministic scan

The Impeccable detector returned no findings for `frontend/src/features/reports/components` (`[]`). It did not flag structural anti-patterns in the scanned markup. The main issues below are therefore product hierarchy, information density, empty-state behavior, and workflow efficiency rather than detector violations.

### Visual evidence

The page was inspected live in Safari at an iPad 11-inch landscape viewport (`1180 × 820`, 87% zoom), including Overview, the lower chart region, and Rankings. The rendered page confirmed the large blank chart regions in the no-activity state, the empty payment donut, the top-of-page-only report context, and the compact ranking controls.

No user-visible Impeccable overlay is available from this run. Safari blocked script injection from the Smart Search field with: “Safari doesn’t allow JavaScript from the Smart Search field.” The temporary detector server was stopped afterward.

## Overall Impression

Sales Reports feels polished, quiet, and trustworthy, but it reads more like a catalog of analytics widgets than a surface that helps an owner decide what to do next. The single biggest opportunity is to preserve report context while scrolling and make empty states intentional, so the page remains useful on quiet days instead of looking unfinished.

## What’s Working

1. **The operating context is clear.** The branch selector, Philippine-time date framing, selected tab, and metric labels make the report’s scope understandable before the numbers are read.

2. **The visual system is disciplined.** Warm neutrals, fine borders, restrained controls, and tabular numbers fit Kapwesto’s operational minimalism and avoid dashboard chrome overload.

3. **The reporting model is responsibly explained.** The page distinguishes gross, refunds, net recorded sales, and own-sales views; chart values also have accessible exact-value text alternatives in the implementation.

## Priority Issues

### [P1] Report context disappears during analysis

**Why it matters:** The report is long enough that the branch, date range, active tab, and refresh action leave the viewport. An owner reviewing weekday or payment patterns must scroll back to confirm which branch and period they are reading. This increases comparison errors.

**Fix:** Create one compact sticky report command bar containing branch, period summary, active tabs, and Refresh. Keep the full date inputs in the existing period section, but preserve a condensed “BGC Satellite · Sep 30, 2026” context row while scrolling. Keep the sticky treatment subtle: paper surface, hairline bottom border, no heavy shadow.

**Suggested command:** `$impeccable layout`

### [P1] Zero-value charts consume space and imply unavailable insight

**Why it matters:** On a no-activity day, the hourly chart still reserves a large plotting area, the payment donut renders an empty ring, and the weekday panel lists seven mostly empty rows. The page feels broken or unfinished even though the data is valid.

**Fix:** Give every chart a designed zero state. Replace the empty donut with a compact “No payment activity” message; collapse the trend plot to a short status block with the selected period; replace seven “No dates” rows with one sentence and optionally a single zero-sales baseline. Render axes and chart legends only when there are values to interpret.

**Suggested command:** `$impeccable distill`

### [P1] The hierarchy does not answer the operator’s first question

**Why it matters:** The page presents equal-weight chart surfaces after the KPI strip. The user has to infer which signal matters most, and the repeated descriptions compete with the numbers. “What happened?” and “where should I look next?” are not visually prioritized.

**Fix:** Keep the four KPIs, then promote one primary trend and one action-oriented ranking block. Demote weekday and payment breakdowns into a secondary “Explore the period” group. Shorten chart descriptions to one-line definitions and move caveats into an accessible help affordance or inline metric note.

**Suggested command:** `$impeccable distill`

### [P2] Rankings become a wide, low-scan table on tablet

**Why it matters:** The staff ranking table has nine columns and a minimum width of `62rem`; on an iPad-sized content area this encourages horizontal scrolling and separates product identity from the metric being ranked. Refund and net columns compete with the selected sort metric.

**Fix:** Make the selected ranking metric the visual anchor. Keep Rank, Product, Merchant, Units/Gross, and Net visible first; move SKU/barcode and refund detail into a responsive secondary row or expandable detail. On tablet, keep the header and product column sticky while allowing only the supporting metrics to scroll horizontally. Show the active metric in the table caption or a compact summary beside the controls.

**Suggested command:** `$impeccable adapt`

### [P2] Filter/loading feedback is too quiet

**Why it matters:** Rankings loads merchant options on demand. During that moment the Merchant selector is disabled and a small “Loading merchants…” message appears beside it. The user can miss why the control is unavailable, especially when the ranking page itself is already visible.

**Fix:** Reserve the selector width, set `aria-busy` on the filter group, and use a compact loading placeholder that preserves the final control shape. When the merchant list fails, keep the Rank by control usable and place the retry message directly beneath the Merchant field. Add a short applied-scope line such as “All merchants · Gross sales · Sep 30, 2026.”

**Suggested command:** `$impeccable clarify`

## Persona Red Flags

### Alex — Power User / Owner

- Must scroll back to the top to confirm branch and date while reviewing lower charts.
- The useful ranking controls are limited to a ten-row page and are not preserved as a working context while navigating the report.
- Repeatedly switching between Gross sales and Units sold requires reorienting to a new table title without a persistent “sorted by” indicator in the table body.

### Priya — Operations Manager

- Overview’s “Top merchants” and “Top products” are unfiltered gross-sales summaries, while Rankings has a merchant filter; the relationship between those two views is not explicitly surfaced.
- Refunds and net recorded sales are present, but the page does not make the operational consequence of refund-heavy periods visually prominent.
- The empty payment donut and weekday rows create noise on quiet periods, making it harder to distinguish “no activity” from “data not loaded.”

### Jordan — First-Time Report Viewer

- “Net recorded sales,” “saved sale identity,” and the long caveat copy require domain knowledge before the user can confidently interpret the page.
- The page starts with a same-day period that can be entirely empty, but does not offer an obvious next step such as a recent-period preset.
- A collapsed icon-only sidebar at tablet width reduces navigation discoverability unless the icons have strong accessible labels/tooltips.

## Minor Observations

- “Reports branch” and “Sales reports” are both understandable, but a shorter, consistent label such as “Branch” would reduce visual weight.
- “Refresh Report” sits at the far right of the tab row and reads like a second navigation system; place it with the period controls or in the sticky command bar.
- The KPI strip repeats units in both the primary value and supporting detail, especially “Completed transactions” plus “0 units sold.”
- The Overview chart title changes between “Hourly sales trend” and “Daily sales trend,” which is correct behavior but deserves a small period-context cue so the mode change feels intentional.
- Use consistent panel header padding and descriptions across staff and merchant variants; the merchant page currently carries more “own” qualifiers, which increases scan cost.

## Questions to Consider

- Is Overview primarily for a fast daily operating check, or is it intended to be a full historical analysis workspace?
- Would the default period be more useful as the last seven days or the last closed business day instead of today, with “Today” as a one-click option?
- Should Rankings be the primary action-oriented view for owners and managers, rather than the third tab after Overview and Daily Data?
- What would an owner need to know in the first ten seconds to decide whether to inspect a merchant, product, refund, or branch?
