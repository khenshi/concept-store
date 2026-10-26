# Plan 09 browser qualification

Date: October 26, 2026

## Environment

- Local frontend at `http://localhost:3001` in the existing Chrome session.
- Signed-in Owner Demo account for Kapwesto Demo Store.
- Initial and restored state: Reports > All branches > Overview > All time,
  Chrome zoom 100%.
- Responsive preview exercised at 390px; desktop page also checked at 200% zoom.
- No transaction, refund, account, or branch data was changed. A temporary
  single-day report filter was applied and then restored to All time.

## Results

- **Pass:** All branches appears alongside the two authorized branch choices in
  the Reports selector. Keyboard Down changes the highlighted option and Escape
  closes the menu without changing the selected scope.
- **Pass:** On desktop, the branch menu and single-calendar date picker fit within
  the viewport. The date picker supports one-day selection and Apply. A temporary
  one-day date remained selected when switching from Rankings to Daily Data.
- **Pass:** Overview, Transactions, Daily Data, and Rankings render in All Branches
  scope. Transactions displays each source branch and its sale detail link points
  to the real branch/sale route with the aggregate Transactions URL in `returnTo`.
- **Pass:** Daily Data displays 15-row pagination (`1/3` for the 44-day All Time
  period). A one-day period with no activity displays the Rankings empty state and
  zero-result pagination.
- **Pass:** At 200% Chrome zoom, the responsive shell remains navigable and the
  branch menu fits horizontally. The calendar's lower controls require scrolling
  the page into view.
- **Fail:** At a 390px responsive viewport, the Reports branch control and its
  open menu are clipped at the right edge. The report-date control/calendar also
  extends beyond the viewport; calendar content and controls are not fully visible
  together. This is a rendered responsive overflow and blocks Plan 09 acceptance.

## Not covered / separate observation

- The rendered session used Owner Demo only. Manager and Merchant authorization
  behavior is covered by the existing automated tests, but their rendered browser
  experience was not checked in this session.
- Calendar keyboard traversal and a forced rendered API error/retry state were not
  verified.
- Chrome DevTools recorded a local CORS failure for
  `http://localhost:3000/auth/refresh` from `http://localhost:3001/login`. The
  Reports data loaded successfully; this session did not establish whether that
  refresh error is current, transient, or related to local API configuration.
- No product code was changed during this qualification.

## Disposition

On October 26, 2026, the user chose to defer the 390px overflow fix for later and
close Plan 09. The issue remains unfixed; this disposition does not change the
failed responsive result above or constitute pilot/release approval. Revisit the
overflow under a future explicitly approved UI/refinement scope.
