const DEMO_SEED_CONFIRMATION = 'I_UNDERSTAND_DISPOSABLE_DEMO_RESET';
const REMOTE_DEMO_RESET_CONFIRMATION = 'I_UNDERSTAND_REMOTE_DEMO_RESET';

type SeedEnvironment = Readonly<Record<string, string | undefined>>;

export type DemoSeedDatabaseIdentity = {
  databaseName: string;
  currentSchema: string;
};

export type DemoSeedMigration = {
  migrationName: string;
  startedAt: Date;
  finishedAt: Date | null;
  rolledBackAt: Date | null;
};

function databaseIdentityFromUrl(connectionString: string): {
  databaseName: string;
  hostname: string;
  isLoopback: boolean;
} {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DEMO_DATABASE_URL must be a valid PostgreSQL URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DEMO_DATABASE_URL must use the PostgreSQL protocol.');
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  if (!databaseName || databaseName.includes('/')) {
    throw new Error('DEMO_DATABASE_URL must identify a database name.');
  }
  return {
    databaseName,
    hostname: url.hostname,
    isLoopback: ['localhost', '127.0.0.1', '[::1]', '::1'].includes(
      url.hostname,
    ),
  };
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

  const identity = databaseIdentityFromUrl(connectionString);
  if (environment.SEED_DEMO_DATABASE_NAME !== identity.databaseName) {
    throw new Error(
      'SEED_DEMO_DATABASE_NAME must exactly match the selected disposable database.',
    );
  }

  if (!identity.isLoopback) {
    if (
      environment.SEED_DEMO_ALLOW_REMOTE_RESET !==
      REMOTE_DEMO_RESET_CONFIRMATION
    ) {
      throw new Error(
        `Remote demo reset requires SEED_DEMO_ALLOW_REMOTE_RESET=${REMOTE_DEMO_RESET_CONFIRMATION}.`,
      );
    }
    if (environment.SEED_DEMO_REMOTE_HOST !== identity.hostname) {
      throw new Error(
        'SEED_DEMO_REMOTE_HOST must exactly match the selected remote database host.',
      );
    }
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
      'Demo seed target identity did not match the verified public development database.',
    );
  }
}

export function assertDemoSeedMigrationState(
  migrations: readonly DemoSeedMigration[],
  expectedLatestMigration: string,
): void {
  const latestAttempts = new Map<string, DemoSeedMigration>();
  for (const migration of migrations) {
    const previous = latestAttempts.get(migration.migrationName);
    if (!previous || migration.startedAt > previous.startedAt) {
      latestAttempts.set(migration.migrationName, migration);
    }
  }

  const effectiveMigrations = [...latestAttempts.values()].sort(
    (left, right) => left.startedAt.getTime() - right.startedAt.getTime(),
  );
  const unfinished = effectiveMigrations.some(
    (migration) => !migration.finishedAt || migration.rolledBackAt,
  );
  if (unfinished) {
    throw new Error('Demo seed requires a database without failed migrations.');
  }

  if (effectiveMigrations.at(-1)?.migrationName !== expectedLatestMigration) {
    throw new Error(
      'Demo seed requires the disposable database to have the current migration history.',
    );
  }
}
