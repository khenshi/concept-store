# Authenticated Shell Refactor

## Part 1 scope

This part establishes the persistent application shell for authenticated organization pages. It changes layout and navigation presentation only; routes, authorization, API behavior, and business rules remain unchanged.

## Implemented layout

- A compact sticky top bar keeps the Concept Store wordmark, access to all organizations, the signed-in email, and logout action available.
- Desktop organization pages use a persistent 15.5rem sidebar and a flexible content canvas.
- The organization switcher is placed at the top of the sidebar.
- Navigation is grouped into Operations and Business and uses the emerald/slate visual language from `DESIGN.md`.
- The active destination uses an emerald edge and quiet mist background instead of the blue treatment shown in the external reference.
- Tablet and mobile layouts use a compact organization bar with an explicit menu toggle. Selecting a destination closes the mobile menu.
- Content remains in document/task order when the layout collapses.

## Preserved behavior

- Existing owner/manager navigation visibility is unchanged.
- Existing organization switching and retry behavior is preserved.
- Existing routes and contextual Space access are unchanged.
- No POS, finance, reporting, billing, or other future functionality was added.

## Validation

- Prettier formatting passed.
- TypeScript checking passed.
- ESLint passed.
- All 28 frontend test files and 81 tests passed.
- The Next.js production build passed.
- Live browser verification was attempted, but no controllable browser was available in the current environment.
