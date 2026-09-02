import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  const requiredEnvironment = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/concept_store',
    FRONTEND_ORIGIN: 'http://localhost:3001',
    JWT_SECRET: 'a-secure-test-secret-with-at-least-32-characters',
  };

  it('applies safe defaults and coerces environment values', () => {
    expect(
      validateEnvironment({ ...requiredEnvironment, PORT: '4000' }),
    ).toMatchObject({
      ...requiredEnvironment,
      NODE_ENV: 'development',
      PORT: 4000,
      JWT_ACCESS_TTL_MINUTES: 15,
      REFRESH_TOKEN_TTL_DAYS: 30,
      DB_POOL_MAX: 10,
      DB_POOL_IDLE_TIMEOUT_MS: 30_000,
      DB_CONNECTION_TIMEOUT_MS: 10_000,
      DB_QUERY_TIMEOUT_MS: 30_000,
      SWAGGER_ENABLED: true,
    });
  });

  it('accepts bounded database pool settings and rejects unsafe values', () => {
    expect(
      validateEnvironment({
        ...requiredEnvironment,
        DB_POOL_MAX: '20',
        DB_QUERY_TIMEOUT_MS: '15000',
      }),
    ).toMatchObject({ DB_POOL_MAX: 20, DB_QUERY_TIMEOUT_MS: 15_000 });

    expect(() =>
      validateEnvironment({ ...requiredEnvironment, DB_POOL_MAX: '0' }),
    ).toThrow('DB_POOL_MAX');
  });

  it('disables Swagger by default in production and supports an explicit override', () => {
    expect(
      validateEnvironment({ ...requiredEnvironment, NODE_ENV: 'production' }),
    ).toMatchObject({ SWAGGER_ENABLED: false });
    expect(
      validateEnvironment({
        ...requiredEnvironment,
        NODE_ENV: 'production',
        SWAGGER_ENABLED: 'true',
      }),
    ).toMatchObject({ SWAGGER_ENABLED: true });
  });

  it('rejects a non-PostgreSQL database URL', () => {
    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        DATABASE_URL: 'mysql://localhost/concept_store',
      }),
    ).toThrow('DATABASE_URL must use the postgresql or postgres protocol');
  });

  it('validates the optional direct migration connection when provided', () => {
    expect(
      validateEnvironment({
        ...requiredEnvironment,
        DIRECT_DATABASE_URL:
          'postgresql://migrator:secret@direct.example.com/concept_store',
      }),
    ).toMatchObject({
      DIRECT_DATABASE_URL:
        'postgresql://migrator:secret@direct.example.com/concept_store',
    });

    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        DIRECT_DATABASE_URL: 'mysql://localhost/concept_store',
      }),
    ).toThrow('DIRECT_DATABASE_URL');
  });

  it('accepts a bounded access-token lifetime and rejects unsafe values', () => {
    expect(
      validateEnvironment({
        ...requiredEnvironment,
        JWT_ACCESS_TTL_MINUTES: '10',
      }),
    ).toMatchObject({ JWT_ACCESS_TTL_MINUTES: 10 });

    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        JWT_ACCESS_TTL_MINUTES: '120',
      }),
    ).toThrow('JWT_ACCESS_TTL_MINUTES');
  });

  it('reports all invalid required configuration', () => {
    expect(() =>
      validateEnvironment({ DATABASE_URL: 'invalid', JWT_SECRET: 'short' }),
    ).toThrow(/DATABASE_URL.*JWT_SECRET/);
  });
});
