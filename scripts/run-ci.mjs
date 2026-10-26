import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = resolve(root, "backend");
const frontend = resolve(root, "frontend");
const composeFile = resolve(root, "docker-compose.ci.yml");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const requiredNode = (
  await readFile(resolve(root, ".node-version"), "utf8")
).trim();
const args = process.argv.slice(2);
const scope = args.find((arg) => !arg.startsWith("-")) ?? "all";
const skipInstall = args.includes("--skip-install");
const validScopes = new Set(["all", "backend", "frontend", "runtime"]);

if (!validScopes.has(scope)) {
  throw new Error(
    `Unknown CI scope "${scope}". Use all, backend, frontend, or runtime.`,
  );
}

if (process.versions.node !== requiredNode) {
  throw new Error(
    `Node ${requiredNode} is required by .node-version; found ${process.versions.node}.`,
  );
}

const postgresPort = process.env.CI_POSTGRES_PORT ?? "55439";
const databaseUrl = `postgresql://postgres:ci-only@127.0.0.1:${postgresPort}/concept_store_ci`;
const projectName = `concept-store-ci-${process.pid}`;
const composeArgs = [
  "compose",
  "--project-name",
  projectName,
  "--file",
  composeFile,
];

const baseBackendEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  DIRECT_DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl,
  FRONTEND_ORIGIN: "http://127.0.0.1:3001",
  JWT_SECRET: "ci-only-secret-at-least-32-characters-long",
  REFRESH_COOKIE_PATH: "/auth",
  LOG_DB_QUERY_PARAMETERS: "false",
  SWAGGER_ENABLED: "false",
};

let databaseAttempted = false;

function run(command, commandArgs, options = {}) {
  const label = [command, ...commandArgs].join(" ");
  console.log(`\n$ ${label}`);

  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd ?? root,
      env: options.env ?? process.env,
      stdio: options.stdio ?? "inherit",
    });

    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(
        new Error(
          `${label} failed${signal ? ` after ${signal}` : ` with exit code ${code}`}.`,
        ),
      );
    });
  });
}

async function installDependencies() {
  if (skipInstall) {
    console.log("\nSkipping npm ci because --skip-install was provided.");
    return;
  }

  if (scope === "all" || scope === "backend" || scope === "runtime") {
    await run(npm, ["ci"], { cwd: backend });
  }
  if (scope === "all" || scope === "frontend" || scope === "runtime") {
    await run(npm, ["ci"], { cwd: frontend });
  }
}

async function startDatabase() {
  if (databaseAttempted) return;
  databaseAttempted = true;
  await run("docker", [...composeArgs, "up", "--detach", "--wait", "postgres"]);
}

async function stopDatabase() {
  if (!databaseAttempted) return;
  try {
    await run("docker", [
      ...composeArgs,
      "down",
      "--volumes",
      "--remove-orphans",
    ]);
  } catch (error) {
    console.error(`\nUnable to clean up the CI database: ${error.message}`);
  } finally {
    databaseAttempted = false;
  }
}

async function runBackendChecks() {
  await startDatabase();
  await run(npm, ["run", "format:check"], { cwd: backend });
  await run(npm, ["run", "lint"], { cwd: backend });
  await run(npm, ["run", "prisma:validate"], { cwd: backend });
  await run(npm, ["run", "prisma:generate"], { cwd: backend });
  await run(npm, ["run", "typecheck"], { cwd: backend, env: baseBackendEnv });
  await run(npm, ["test", "--", "--runInBand"], {
    cwd: backend,
    env: baseBackendEnv,
  });
  await run(npm, ["run", "test:e2e", "--", "--runInBand"], {
    cwd: backend,
    env: baseBackendEnv,
  });
  await run(npm, ["run", "test:integration"], {
    cwd: backend,
    env: baseBackendEnv,
  });
  await run(npm, ["run", "build"], { cwd: backend, env: baseBackendEnv });
}

async function runFrontendChecks() {
  const env = {
    ...process.env,
    NEXT_PUBLIC_API_URL: "http://127.0.0.1:3000",
  };
  await run(npm, ["run", "format:check"], { cwd: frontend });
  await run(npm, ["run", "lint"], { cwd: frontend });
  await run(npm, ["run", "typecheck"], { cwd: frontend, env });
  await run(npm, ["test"], { cwd: frontend, env });
  await run(npm, ["run", "build"], { cwd: frontend, env });
}

async function waitForHttp(url, child, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`${label} exited before becoming ready.`);
    }
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) return;
    } catch {}
    await delay(1000);
  }
  throw new Error(`${label} did not become ready at ${url}.`);
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveExit) => child.once("exit", resolveExit)),
    delay(5000),
  ]);
  if (child.exitCode === null && child.signalCode === null)
    child.kill("SIGKILL");
}

async function runProxySmoke() {
  const apiEnv = {
    ...baseBackendEnv,
    NODE_ENV: "production",
    PORT: "3100",
    FRONTEND_ORIGIN: "http://127.0.0.1:3101",
    EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "re_runtime_test",
    EMAIL_FROM: "CI <no-reply@example.com>",
  };
  const frontendEnv = {
    ...process.env,
    NODE_ENV: "production",
    PORT: "3101",
    NEXT_PUBLIC_API_URL: "http://127.0.0.1:3101/api",
    NEXT_API_UPSTREAM_URL: "http://127.0.0.1:3100",
  };
  const api = spawn(process.execPath, ["dist/src/main.js"], {
    cwd: backend,
    env: apiEnv,
    stdio: "inherit",
  });
  const frontendServer = spawn(process.execPath, ["scripts/start.mjs"], {
    cwd: frontend,
    env: frontendEnv,
    stdio: "inherit",
  });

  try {
    await waitForHttp("http://127.0.0.1:3100/health/ready", api, "Built API");
    await waitForHttp(
      "http://127.0.0.1:3101/",
      frontendServer,
      "Built frontend",
    );
    const response = await fetch("http://127.0.0.1:3101/api/health/live?ci=1", {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(
        `Frontend proxy health check returned ${response.status}.`,
      );
    }
  } finally {
    await stopProcess(frontendServer);
    await stopProcess(api);
  }
}

async function runRuntimeChecks() {
  await startDatabase();
  const runtimeEnv = {
    ...baseBackendEnv,
    TEST_RUNTIME_DATABASE_URL: databaseUrl,
    TEST_RUNTIME_DATABASE_NAME: "concept_store_ci",
    TEST_RUNTIME_PORT: "3100",
  };
  const frontendBuildEnv = {
    ...process.env,
    NODE_ENV: "production",
    NEXT_PUBLIC_API_URL: "http://127.0.0.1:3101/api",
    NEXT_API_UPSTREAM_URL: "http://127.0.0.1:3100",
  };
  await run(npm, ["run", "build"], { cwd: backend, env: runtimeEnv });
  await run(npm, ["run", "build"], { cwd: frontend, env: frontendBuildEnv });
  await run(npm, ["run", "test:runtime:ci"], {
    cwd: backend,
    env: runtimeEnv,
  });
  await runProxySmoke();
}

try {
  await run("docker", ["compose", "version"]);
  await installDependencies();

  if (scope === "all" || scope === "backend") await runBackendChecks();
  if (scope === "all" || scope === "frontend") await runFrontendChecks();
  if (scope === "all" || scope === "runtime") await runRuntimeChecks();

  console.log(`\nLocal CI passed (${scope}).`);
} finally {
  await stopDatabase();
}
