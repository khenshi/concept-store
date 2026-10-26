import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const target = process.env.TEST_RUNTIME_DATABASE_URL;
const databaseName = process.env.TEST_RUNTIME_DATABASE_NAME;
assert.ok(
  target && databaseName,
  'TEST_RUNTIME_DATABASE_URL and TEST_RUNTIME_DATABASE_NAME are required',
);
const url = new URL(target);
assert.equal(url.protocol, 'postgresql:');
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.pathname, `/${databaseName}`);

const port = process.env.TEST_RUNTIME_PORT ?? '3100';
await access('dist/src/main.js');

const child = spawn(process.execPath, ['dist/src/main.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: port,
    DATABASE_URL: target,
    DIRECT_DATABASE_URL: target,
    FRONTEND_ORIGIN: 'http://127.0.0.1:3101',
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_runtime_test',
    EMAIL_FROM: 'Kapwesto <no-reply@example.com>',
    JWT_SECRET: 'ci-runtime-secret-at-least-32-characters-long',
    LOG_LEVEL: 'warn',
    LOG_HTTP_REQUESTS: 'false',
    LOG_DB_QUERIES: 'false',
    LOG_DB_QUERY_PARAMETERS: 'false',
    SWAGGER_ENABLED: 'false',
    DB_POOL_MAX: '2',
    DB_CONNECTION_TIMEOUT_MS: '1000',
    DB_QUERY_TIMEOUT_MS: '2000',
    REFRESH_COOKIE_PATH: '/auth',
  },
  stdio: 'ignore',
});
const ended = once(child, 'exit');

async function request(path) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    signal: AbortSignal.timeout(5000),
  });
}

async function stop() {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const completed = await Promise.race([ended, delay(5000).then(() => false)]);
  if (completed === false && child.exitCode === null) {
    child.kill('SIGKILL');
    await ended;
  }
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) break;
    try {
      ready = (await request('/health/ready')).status === 200;
    } catch {}
    if (ready) break;
    await delay(250);
  }
  assert.ok(ready, 'Built API did not become ready');

  const root = await request('/');
  assert.equal(root.status, 200);
  assert.deepEqual(await root.json(), { status: 'ok' });

  const live = await request('/health/live');
  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), { status: 'ok' });

  const health = await request('/health/ready');
  assert.equal(health.status, 200);
  assert.match(health.headers.get('cache-control') ?? '', /no-store/);
  assert.deepEqual(await health.json(), { status: 'ready' });
} finally {
  await stop();
}
