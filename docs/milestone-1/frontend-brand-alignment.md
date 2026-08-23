# Frontend Brand Alignment

## Scope

This Milestone 1 part aligns the existing public and authentication interfaces with the approved [brand guidelines](brand.md). It changes presentation only and does not add authentication, organization, role, or dashboard behavior.

## Shared design foundation

The global frontend styles now use the documented brand tokens:

- emerald primary colors for actions and focus states
- slate background, surface, text, muted text, and borders
- the approved success, warning, and error colors
- Inter through the Next.js font integration

The interface uses neutral solid surfaces, restrained borders, and consistent radii. The previous gradient background, editorial serif typography, translucent surfaces, and large decorative shadow were removed.

## Applied surfaces

- public landing page
- login and registration pages
- authentication loading and error states
- authenticated landing page and logout action

## Validation

Run from `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```
