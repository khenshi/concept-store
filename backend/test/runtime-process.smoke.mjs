import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { access, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import pg from 'pg';

const target = process.env.TEST_DATABASE_URL;
const container = process.env.TEST_RUNTIME_CONTAINER;
assert.ok(
  target && container,
  'Explicit disposable database and container required',
);
const url = new URL(target);
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.pathname, '/concept_store_plan02_test');
assert.equal(container, 'concept-store-plan02-20261025');

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

function start(port, overrides = {}) {
  const env = {
    PATH: process.env.PATH,
    NODE_ENV: 'production',
    PORT: String(port),
    DATABASE_URL: target,
    DIRECT_DATABASE_URL: target,
    FRONTEND_ORIGIN: 'http://localhost:3001',
    JWT_SECRET: 'isolated-runtime-test-secret-at-least-32-characters',
    LOG_HTTP_REQUESTS: 'false',
    LOG_DB_QUERIES: 'false',
    LOG_DB_QUERY_PARAMETERS: 'false',
    LOG_LEVEL: 'info',
    SWAGGER_ENABLED: 'false',
    DB_CONNECTION_TIMEOUT_MS: '1000',
    DB_QUERY_TIMEOUT_MS: '2000',
    ...overrides,
  };
  const child = spawn('npm', ['run', 'start:prod'], {
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });
  const ended = once(child, 'exit');
  return { child, ended, output: () => output };
}

async function stop(running) {
  if (running.child.exitCode !== null || running.child.signalCode !== null)
    return;
  process.kill(-running.child.pid, 'SIGTERM');
  const timer = globalThis.setTimeout(() => {
    try {
      process.kill(-running.child.pid, 'SIGKILL');
    } catch {}
  }, 5000);
  try {
    const [, signal] = await running.ended;
    assert.notEqual(signal, 'SIGKILL', 'Graceful shutdown exceeded deadline');
  } finally {
    clearTimeout(timer);
  }
}

async function status(port, route) {
  return fetch(`http://127.0.0.1:${port}${route}`, {
    signal: AbortSignal.timeout(5000),
  });
}

test(
  'fresh production command, dependency loss/recovery and shutdown',
  { timeout: 45000 },
  async () => {
    const pkg = JSON.parse(await readFile('package.json', 'utf8'));
    assert.equal(pkg.scripts['start:prod'], 'node dist/src/main.js');
    await access('dist/src/main.js');
    const client = new pg.Client({ connectionString: target });
    await client.connect();
    try {
      const identity = await client.query('SELECT current_database() AS name');
      assert.equal(identity.rows[0].name, 'concept_store_plan02_test');
      const tables = await client.query(
        "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')",
      );
      assert.equal(tables.rows[0].count, 0);
    } finally {
      await client.end();
    }
    const port = await freePort();
    const running = start(port);
    let paused = false;
    try {
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        try {
          ready = (await status(port, '/health/ready')).status === 200;
        } catch {}
        if (ready) break;
        assert.equal(running.child.exitCode, null, running.output());
        await delay(100);
      }
      assert.ok(ready, 'Built API did not become ready');
      for (const route of ['/', '/health/live']) {
        const response = await status(port, route);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: 'ok' });
      }
      const response = await status(port, '/health/ready');
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.deepEqual(await response.json(), { status: 'ready' });
      execFileSync('docker', ['pause', container]);
      paused = true;
      const failure = await status(port, '/health/ready');
      assert.equal(failure.status, 503);
      assert.deepEqual(await failure.json(), { status: 'unavailable' });
      assert.equal((await status(port, '/health/live')).status, 200);
      execFileSync('docker', ['unpause', container]);
      paused = false;
      assert.equal((await status(port, '/health/ready')).status, 200);
      assert.ok(!running.output().includes('request completed'));
      assert.ok(!running.output().includes(url.password));
    } finally {
      if (paused) execFileSync('docker', ['unpause', container]);
      await stop(running);
    }
  },
);

test(
  'startup failure is nonzero and sanitized',
  { timeout: 15000 },
  async () => {
    for (const overrides of [
      { JWT_SECRET: 'private-invalid-secret' },
      { DATABASE_URL: target.replace(/:\d+\//, ':1/') },
    ]) {
      const running = start(await freePort(), overrides);
      const timer = globalThis.setTimeout(() => {
        try {
          process.kill(-running.child.pid, 'SIGKILL');
        } catch {}
      }, 5000);
      try {
        const [code, signal] = await running.ended;
        assert.equal(signal, null);
        assert.notEqual(code, 0);
        assert.ok(running.output().includes('API startup failed'));
        for (const secret of [
          url.password,
          'private-invalid-secret',
          'postgresql://',
        ])
          assert.ok(
            !running.output().includes(secret),
            'Startup disclosed private config',
          );
      } finally {
        clearTimeout(timer);
        await stop(running);
      }
    }
  },
);
