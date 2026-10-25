const DEMO_SEED_CONFIRMATION = 'I_UNDERSTAND_DISPOSABLE_DEMO_RESET';

type SeedEnvironment = Readonly<Record<string, string | undefined>>;

export type DemoSeedDatabaseIdentity = {
  databaseName: string;
  currentSchema: string;
};

export type DemoSeedMigration = {
  migrationName: string;
  finishedAt: Date | null;
  rolledBackAt: Date | null;
};

function databaseNameFromUrl(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DEMO_DATABASE_URL must be a valid PostgreSQL URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DEMO_DATABASE_URL must use the PostgreSQL protocol.');
  }
  if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname)) {
    throw new Error(
      'Demo seed requires a loopback disposable database target.',
    );
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  if (!databaseName || databaseName.includes('/')) {
    throw new Error('DEMO_DATABASE_URL must identify a database name.');
  }
  return databaseName;
}

export function getDemoSeedConnectionString(
  resetRequested: boolean,
  environment: SeedEnvironment,
): string {
  if (!resetRequested) {
    throw new Error('Foundation demo seed requires the --reset flag.');
  }

  if (
    !['development', 'test'].includes(environment.NODE_ENV ?? 'development')
  ) {
    throw new Error('Demo seed is restricted to development/test.');
  }

  const connectionString = environment.DEMO_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DEMO_DATABASE_URL is required; application database URLs are not accepted.',
    );
  }
  if (environment.SEED_DEMO_CONFIRM !== DEMO_SEED_CONFIRMATION) {
    throw new Error(
      `Set SEED_DEMO_CONFIRM=${DEMO_SEED_CONFIRMATION} to confirm the disposable reset.`,
    );
  }

  const databaseName = databaseNameFromUrl(connectionString);
  if (environment.SEED_DEMO_DATABASE_NAME !== databaseName) {
    throw new Error(
      'SEED_DEMO_DATABASE_NAME must exactly match the selected disposable database.',
    );
  }

  return connectionString;
}

export function assertDemoSeedDatabaseIdentity(
  identity: DemoSeedDatabaseIdentity,
  expectedDatabaseName: string,
): void {
  if (
    identity.databaseName !== expectedDatabaseName ||
    identity.currentSchema !== 'public'
  ) {
    throw new Error(
      'Demo seed target identity did not match the verified public disposable database.',
    );
  }
}

export function assertDemoSeedMigrationState(
  migrations: readonly DemoSeedMigration[],
  expectedLatestMigration: string,
): void {
  const unfinished = migrations.some(
    (migration) => !migration.finishedAt || migration.rolledBackAt,
  );
  if (unfinished) {
    throw new Error('Demo seed requires a database without failed migrations.');
  }

  if (migrations[0]?.migrationName !== expectedLatestMigration) {
    throw new Error(
      'Demo seed requires the disposable database to have the current migration history.',
    );
  }
}
