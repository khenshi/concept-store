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

  it('requires a loopback URL and exact database-name confirmation', () => {
    expect(() =>
      getDemoSeedConnectionString(true, {
        ...baseEnvironment,
        DEMO_DATABASE_URL:
          'postgresql://demo:demo@db.example.test:5432/concept_store_demo',
      }),
    ).toThrow('loopback');
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
            finishedAt: new Date(),
            rolledBackAt: null,
          },
        ],
        '20261011010000_latest',
      ),
    ).not.toThrow();
  });
});
