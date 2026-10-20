# POS loading header consistency

Approved and implemented October 20, 2026: retain POS title/description during
organization and authorized branch loading. Reuse a POS-owned loading header
with shared PageHeader and ListSkeleton; placeholders cover branch selection
and content only. Errors retain title/retry feedback without a loading selector.
Preserve access checks, checkout behavior and full-screen presentation.

Validation: 27 affected POS tests passed, including pending access/branch cases.
Typecheck, focused lint, formatting and diff checks passed. Rendered browser QA
was not performed. No dependencies, backend changes or commits.
