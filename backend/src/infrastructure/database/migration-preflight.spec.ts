import {
  getMigrationPreflightConfig,
  inspectMigrationHistory,
  MIGRATION_PREFLIGHT_CONFIRMATION,
  MigrationFile,
  MigrationRecord,
} from './migration-preflight';

const files: MigrationFile[] = [
  { name: '20260911010000_foundation_baseline', checksum: 'foundation' },
  { name: '20261011010000_latest', checksum: 'latest' },
];

function record(
  name: string,
  checksum: string,
  finishedAt: Date | null = new Date(),
  startedAt = new Date(),
): MigrationRecord {
  return { name, checksum, startedAt, finishedAt, rolledBackAt: null };
}

describe('migration preflight', () => {
  it('requires a separate explicit read-only target', () => {
    expect(() => getMigrationPreflightConfig({})).toThrow(
      'MIGRATION_PREFLIGHT_DATABASE_URL',
    );
    expect(() =>
      getMigrationPreflightConfig({
        MIGRATION_PREFLIGHT_DATABASE_URL:
          'postgresql://user:pass@db.example.test/store',
        MIGRATION_PREFLIGHT_DATABASE_NAME: 'store',
      }),
    ).toThrow('MIGRATION_PREFLIGHT_CONFIRM');
    expect(
      getMigrationPreflightConfig({
        MIGRATION_PREFLIGHT_DATABASE_URL:
          'postgresql://user:pass@db.example.test/store',
        MIGRATION_PREFLIGHT_DATABASE_NAME: 'store',
        MIGRATION_PREFLIGHT_CONFIRM: MIGRATION_PREFLIGHT_CONFIRMATION,
      }),
    ).toEqual({
      connectionString: 'postgresql://user:pass@db.example.test/store',
      databaseName: 'store',
    });
  });

  it('classifies empty and upgrade-needed histories', () => {
    expect(inspectMigrationHistory(files, [])).toMatchObject({
      state: 'empty',
      pendingMigrations: files.map((file) => file.name),
    });
    expect(
      inspectMigrationHistory(files, [
        record(files[0].name, files[0].checksum),
      ]),
    ).toMatchObject({
      state: 'upgrade-needed',
      pendingMigrations: [files[1].name],
    });
  });

  it('accepts current history and rejects drift, failures, and reordering', () => {
    expect(
      inspectMigrationHistory(
        files,
        files.map((file) => record(file.name, file.checksum)),
      ),
    ).toMatchObject({ state: 'current', issues: [] });
    expect(
      inspectMigrationHistory(files, [record(files[0].name, 'changed')]).state,
    ).toBe('unsafe');
    expect(
      inspectMigrationHistory(files, [
        record(files[0].name, files[0].checksum, null),
      ]).state,
    ).toBe('unsafe');
    expect(
      inspectMigrationHistory(files, [record(files[1].name, files[1].checksum)])
        .state,
    ).toBe('unsafe');
  });

  it('accepts a resolved failed attempt followed by a successful retry', () => {
    const failedStart = new Date('2026-10-11T00:00:00.000Z');
    const successfulStart = new Date('2026-10-11T00:02:00.000Z');
    expect(
      inspectMigrationHistory(files, [
        record(
          files[0].name,
          files[0].checksum,
          new Date(),
          new Date('2026-10-10T00:00:00.000Z'),
        ),
        {
          name: files[1].name,
          checksum: files[1].checksum,
          startedAt: failedStart,
          finishedAt: null,
          rolledBackAt: new Date('2026-10-11T00:01:00.000Z'),
        },
        {
          name: files[1].name,
          checksum: files[1].checksum,
          startedAt: successfulStart,
          finishedAt: new Date('2026-10-11T00:03:00.000Z'),
          rolledBackAt: null,
        },
      ]).state,
    ).toBe('current');
  });
});
