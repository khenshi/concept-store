import 'dotenv/config';
import { Client } from 'pg';
import { join } from 'node:path';
import {
  getMigrationPreflightConfig,
  inspectMigrationHistory,
  loadMigrationFiles,
} from './migration-preflight';

async function main(): Promise<void> {
  const { connectionString, databaseName } = getMigrationPreflightConfig(
    process.env,
  );
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const [identity] = (
      await client.query<{
        database_name: string;
        current_schema: string;
      }>(
        'SELECT current_database() AS database_name, current_schema() AS current_schema',
      )
    ).rows;
    if (
      identity?.database_name !== databaseName ||
      identity.current_schema !== 'public'
    ) {
      throw new Error(
        'Migration preflight target identity did not match the verified public database.',
      );
    }

    const migrationTable = (
      await client.query<{ table_exists: boolean }>(
        "SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS table_exists",
      )
    ).rows[0];
    if (!migrationTable?.table_exists) {
      console.info(
        JSON.stringify({
          databaseName,
          state: 'empty',
          reason: 'no migration history',
        }),
      );
      return;
    }

    const records = (
      await client.query<{
        migration_name: string;
        checksum: string;
        finished_at: Date | null;
        rolled_back_at: Date | null;
      }>(
        'SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY started_at, migration_name',
      )
    ).rows;
    const result = inspectMigrationHistory(
      loadMigrationFiles(join(process.cwd(), 'prisma/migrations')),
      records.map((record) => ({
        name: record.migration_name,
        checksum: record.checksum,
        finishedAt: record.finished_at,
        rolledBackAt: record.rolled_back_at,
      })),
    );
    console.info(JSON.stringify({ databaseName, ...result }));
    if (result.state === 'unsafe') process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Migration preflight failed.',
  );
  process.exitCode = 1;
});
