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

The disposable PostgreSQL integration run currently passes 329 tests with one
intentional skip. The HTTP/e2e suite passes 273 tests across nine suites after
its fixtures were updated for organization lifecycle status and Payment Account
contracts. Branch protection and required-check settings remain repository-side
controls that need an owner to configure and verify.

For local verification, use the existing app commands from each package. Backend
integration and runtime smoke commands require explicit disposable localhost
targets; they never fall back to application URLs or run the demo seed.

## One-command local CI

The root command mirrors the required backend, frontend and built-runtime jobs:

```bash
npm run ci
```

The focused commands are available when iterating on one job:

```bash
npm run ci:backend
npm run ci:frontend
npm run ci:runtime
```

The runner requires the exact Node version in `.node-version` and Docker with
Compose v2. It installs the locked dependencies with `npm ci`, starts a
disposable PostgreSQL 17 container from `docker-compose.ci.yml`, runs the checks,
and removes the container and its data on completion or failure. Use
`npm run ci -- --skip-install` when both package lockfiles are already installed.

The default PostgreSQL host port is `55439`; override it if that port is already
occupied:

```bash
CI_POSTGRES_PORT=55440 npm run ci
```

The database is intentionally empty and uses CI-only credentials. The command
must never be pointed at a development, staging, or deployed application
database.
