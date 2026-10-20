# Merchant form refinement

**Status:** Implemented locally October 20, 2026.

The Add Merchant dialog now uses the compact form width, keeps generic
validation feedback out of the footer action row, and filters unsupported
characters from code, email and phone fields as they are entered. Existing
schema validation, normalization, API behavior, authorization, edit workflow
and server-error feedback remain in place.

## Scope

- Reused the shared `FormDialog` size variant and `TextField` primitives.
- Sanitized only field-specific characters that cannot be part of the existing
  merchant input contract; backend validation remains authoritative.
- Kept field-level validation and first-invalid-field focus unchanged.
- Updated Merchant module and frontend experience documentation.

## Verification

- Focused Merchant form and directory tests: 12 passed.
- Frontend typecheck passed.
- Focused ESLint passed.
- Prettier and `git diff --check` passed.
