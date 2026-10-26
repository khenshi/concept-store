import {
  assertDemoSeedDatabaseIdentity,
  assertDemoSeedMigrationState,
  getDemoSeedConnectionString,
} from './demo-seed-safety';

const baseEnvironment = {
  NODE_ENV: 'development',
  DEMO_DATABASE_URL:
    'postgresql://demo:demo@127.0.0.1:55439/concept_store_demo',
  SEED_DEMO_CONFIRM: 'I_UNDERSTAND_DISPOSABLE_DEMO_RESET',
  SEED_DEMO_DATABASE_NAME: 'concept_store_demo',
};

describe('demo seed target safety', () => {
  it('requires an explicit reset and disposable target confirmation', () => {
    expect(() => getDemoSeedConnectionString(false, baseEnvironment)).toThrow(
      '--reset',
    );
    expect(() =>
      getDemoSeedConnectionString(true, {
        ...baseEnvironment,
        SEED_DEMO_CONFIRM: undefined,
      }),
    ).toThrow('SEED_DEMO_CONFIRM');
  });

  it('rejects production overrides and ambient application URLs', () => {
    expect(() =>
      getDemoSeedConnectionString(true, {
        ...baseEnvironment,
        NODE_ENV: 'production',
      }),
    ).toThrow('development/test');
    expect(() =>
      getDemoSeedConnectionString(true, {
        NODE_ENV: 'development',
        DATABASE_URL: baseEnvironment.DEMO_DATABASE_URL,
        SEED_DEMO_CONFIRM: baseEnvironment.SEED_DEMO_CONFIRM,
        SEED_DEMO_DATABASE_NAME: baseEnvironment.SEED_DEMO_DATABASE_NAME,
      }),
    ).toThrow('DEMO_DATABASE_URL');
  });

  it('requires a confirmed target and exact database-name confirmation', () => {
    expect(() =>
      getDemoSeedConnectionString(true, {
        ...baseEnvironment,
        DEMO_DATABASE_URL:
          'postgresql://demo:demo@db.example.test:5432/concept_store_demo',
      }),
    ).toThrow('SEED_DEMO_ALLOW_REMOTE_RESET');
    expect(() =>
      getDemoSeedConnectionString(true, {
        ...baseEnvironment,
        DEMO_DATABASE_URL:
          'postgresql://demo:demo@db.example.test:5432/concept_store_demo',
        SEED_DEMO_ALLOW_REMOTE_RESET: 'I_UNDERSTAND_REMOTE_DEMO_RESET',
      }),
    ).toThrow('SEED_DEMO_REMOTE_HOST');
    expect(
      getDemoSeedConnectionString(true, {
        ...baseEnvironment,
        DEMO_DATABASE_URL:
          'postgresql://demo:demo@db.example.test:5432/concept_store_demo',
        SEED_DEMO_ALLOW_REMOTE_RESET: 'I_UNDERSTAND_REMOTE_DEMO_RESET',
        SEED_DEMO_REMOTE_HOST: 'db.example.test',
      }),
    ).toBe('postgresql://demo:demo@db.example.test:5432/concept_store_demo');
    expect(() =>
      getDemoSeedConnectionString(true, {
        ...baseEnvironment,
        SEED_DEMO_DATABASE_NAME: 'another_database',
      }),
    ).toThrow('exactly match');
    expect(getDemoSeedConnectionString(true, baseEnvironment)).toBe(
      baseEnvironment.DEMO_DATABASE_URL,
    );
  });

  it('rejects an unexpected database identity or schema', () => {
    expect(() =>
      assertDemoSeedDatabaseIdentity(
        { databaseName: 'other_database', currentSchema: 'public' },
        'concept_store_demo',
      ),
    ).toThrow('identity');
    expect(() =>
      assertDemoSeedDatabaseIdentity(
        { databaseName: 'concept_store_demo', currentSchema: 'tenant' },
        'concept_store_demo',
      ),
    ).toThrow('identity');
  });

  it('rejects failed or stale migration history', () => {
    expect(() =>
      assertDemoSeedMigrationState(
        [
          {
            migrationName: '20261011010000_latest',
            startedAt: new Date('2026-10-11T00:00:00.000Z'),
            finishedAt: null,
            rolledBackAt: null,
          },
        ],
        '20261011010000_latest',
      ),
    ).toThrow('failed migrations');
    expect(() =>
      assertDemoSeedMigrationState(
        [
          {
            migrationName: '20261010010000_old',
            startedAt: new Date('2026-10-10T00:00:00.000Z'),
            finishedAt: new Date(),
            rolledBackAt: null,
          },
        ],
        '20261011010000_latest',
      ),
    ).toThrow('current migration history');
    expect(() =>
      assertDemoSeedMigrationState(
        [
          {
            migrationName: '20261011010000_latest',
            startedAt: new Date('2026-10-11T00:00:00.000Z'),
            finishedAt: new Date(),
            rolledBackAt: null,
          },
        ],
        '20261011010000_latest',
      ),
    ).not.toThrow();
  });

  it('accepts a rolled-back attempt superseded by a successful retry', () => {
    expect(() =>
      assertDemoSeedMigrationState(
        [
          {
            migrationName: '20261011010000_latest',
            startedAt: new Date('2026-10-11T00:00:00.000Z'),
            finishedAt: null,
            rolledBackAt: new Date('2026-10-11T00:01:00.000Z'),
          },
          {
            migrationName: '20261011010000_latest',
            startedAt: new Date('2026-10-11T00:02:00.000Z'),
            finishedAt: new Date('2026-10-11T00:03:00.000Z'),
            rolledBackAt: null,
          },
        ],
        '20261011010000_latest',
      ),
    ).not.toThrow();
  });
});
