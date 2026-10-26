import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const MIGRATION_PREFLIGHT_CONFIRMATION =
  'I_UNDERSTAND_READ_ONLY_MIGRATION_PREFLIGHT';

export type MigrationFile = {
  name: string;
  checksum: string;
};

export type MigrationRecord = {
  name: string;
  checksum: string;
  startedAt: Date;
  finishedAt: Date | null;
  rolledBackAt: Date | null;
};

export type MigrationHistoryInspection = {
  state: 'empty' | 'current' | 'upgrade-needed' | 'unsafe';
  pendingMigrations: string[];
  issues: string[];
};

type PreflightEnvironment = Readonly<Record<string, string | undefined>>;

export function getMigrationPreflightConfig(
  environment: PreflightEnvironment,
): { connectionString: string; databaseName: string } {
  const connectionString = environment.MIGRATION_PREFLIGHT_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'MIGRATION_PREFLIGHT_DATABASE_URL is required; runtime database URLs are not accepted.',
    );
  }
  if (
    environment.MIGRATION_PREFLIGHT_CONFIRM !== MIGRATION_PREFLIGHT_CONFIRMATION
  ) {
    throw new Error(
      `Set MIGRATION_PREFLIGHT_CONFIRM=${MIGRATION_PREFLIGHT_CONFIRMATION} to confirm the read-only check.`,
    );
  }
  const databaseName = environment.MIGRATION_PREFLIGHT_DATABASE_NAME;
  if (!databaseName) {
    throw new Error('MIGRATION_PREFLIGHT_DATABASE_NAME is required.');
  }
  try {
    const url = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      throw new Error('MIGRATION_PREFLIGHT_DATABASE_URL must use PostgreSQL.');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('must use')) {
      throw error;
    }
    throw new Error('MIGRATION_PREFLIGHT_DATABASE_URL must be a valid URL.');
  }
  return { connectionString, databaseName };
}

export function loadMigrationFiles(migrationsRoot: string): MigrationFile[] {
  return readdirSync(migrationsRoot)
    .filter((name) => /^\d/.test(name))
    .sort()
    .map((name) => ({
      name,
      checksum: createHash('sha256')
        .update(readFileSync(join(migrationsRoot, name, 'migration.sql')))
        .digest('hex'),
    }));
}

export function inspectMigrationHistory(
  files: readonly MigrationFile[],
  records: readonly MigrationRecord[],
): MigrationHistoryInspection {
  const issues: string[] = [];
  const expectedNames = files.map((file) => file.name);
  const expectedChecksums = new Map(
    files.map((file) => [file.name, file.checksum]),
  );

  records.forEach((record) => {
    if (!expectedChecksums.has(record.name)) {
      issues.push(`migration ${record.name} is not in the repository`);
    } else if (expectedChecksums.get(record.name) !== record.checksum) {
      issues.push(
        `migration ${record.name} checksum differs from the repository`,
      );
    }
  });

  const latestAttempts = new Map<string, MigrationRecord>();
  for (const record of records) {
    const previous = latestAttempts.get(record.name);
    if (!previous || record.startedAt > previous.startedAt) {
      latestAttempts.set(record.name, record);
    }
  }
  const effectiveRecords = [...latestAttempts.values()].sort(
    (left, right) => left.startedAt.getTime() - right.startedAt.getTime(),
  );

  effectiveRecords.forEach((record, index) => {
    if (!record.finishedAt || record.rolledBackAt) {
      issues.push(`migration ${record.name} is unfinished or rolled back`);
    }
    if (expectedNames[index] !== record.name) {
      issues.push(`migration history order diverges at ${record.name}`);
    }
  });

  if (issues.length > 0) {
    return { state: 'unsafe', pendingMigrations: [], issues };
  }

  const pendingMigrations = expectedNames.slice(effectiveRecords.length);
  if (effectiveRecords.length === 0) {
    return { state: 'empty', pendingMigrations, issues };
  }
  if (pendingMigrations.length > 0) {
    return { state: 'upgrade-needed', pendingMigrations, issues };
  }
  return { state: 'current', pendingMigrations, issues };
}
