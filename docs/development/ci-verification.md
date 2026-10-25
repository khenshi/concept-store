# CI verification

The repository workflow at `.github/workflows/ci.yml` runs on pull requests and
pushes to `main`. It uses Node `20.19.4` from `.node-version`, separate npm
lockfiles and synthetic credentials only. GitHub Actions revisions are pinned;
the workflow does not deploy, run migrations against an application database,
seed demo data or use live secrets.

The backend job runs formatting, lint, Prisma validation/generation, full
application-and-test-source typechecking, unit tests, HTTP tests, isolated
PostgreSQL integration tests and a clean build. The frontend job runs formatting,
lint, typechecking, all Vitest tests and a production build. The runtime job
starts the built Nest process against a disposable PostgreSQL service, checks
liveness/readiness, then starts the built Next process and verifies the public
`/api/health/live` proxy route.

The stable `Required checks` job fails if any mandatory job fails, is cancelled or
is skipped. Branch protection and required-check settings are repository-side
controls and still need an owner to configure and verify them; this workflow
file alone does not claim that enforcement exists.

The October 25 disposable PostgreSQL run passed 311 tests, skipped one and
reported four existing failures: sales-persistence pagination expects 50 rather
than the current 15-row default, inventory movement pagination has the same stale
expectation, merchant-branch pagination expects 10 rather than the current 12
fixture rows, and the space-types migration fixture violates a current null
constraint. The workflow keeps these failures visible; it does not exclude or
weaken the integration gate.

For local verification, use the existing app commands from each package. Backend
integration and runtime smoke commands require explicit disposable localhost
targets; they never fall back to application URLs or run the demo seed.
