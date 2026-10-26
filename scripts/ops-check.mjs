import process from "node:process";

const timeoutMs = parseTimeout(process.env.OPS_TIMEOUT_MS ?? "5000");
const apiBase = normalizeBase(
  process.env.OPS_API_URL ?? "http://127.0.0.1:3000",
  "OPS_API_URL",
);
const frontendBase = normalizeBase(
  process.env.OPS_FRONTEND_URL ?? "http://127.0.0.1:3001",
  "OPS_FRONTEND_URL",
);

const checks = [
  {
    label: "API liveness",
    url: `${apiBase}/health/live`,
    expectedStatus: "ok",
  },
  {
    label: "API readiness",
    url: `${apiBase}/health/ready`,
    expectedStatus: "ready",
  },
  {
    label: "Frontend reachability",
    url: `${frontendBase}/`,
    expectedStatus: null,
  },
  {
    label: "Same-origin API proxy",
    url: `${frontendBase}/api/health/live`,
    expectedStatus: "ok",
  },
];

let failed = false;

for (const check of checks) {
  const result = await runCheck(check);
  const prefix = result.ok ? "PASS" : "FAIL";
  console.log(`${prefix} ${check.label}: ${result.message}`);
  failed ||= !result.ok;
}

if (failed) process.exitCode = 1;

async function runCheck(check) {
  try {
    const response = await fetch(check.url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}` };
    }

    if (!check.expectedStatus) {
      return { ok: true, message: `HTTP ${response.status}` };
    }

    const body = await response.json();
    if (body?.status !== check.expectedStatus) {
      return { ok: false, message: "unexpected health response" };
    }

    return { ok: true, message: `HTTP ${response.status}` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "request failed",
    };
  }
}

function normalizeBase(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`);
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${name} must be an origin URL without credentials or query parameters.`);
  }

  return url.href.replace(/\/+$/, "");
}

function parseTimeout(value) {
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout < 250 || timeout > 30_000) {
    throw new Error("OPS_TIMEOUT_MS must be an integer between 250 and 30000.");
  }
  return timeout;
}
