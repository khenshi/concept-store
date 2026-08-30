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
      SWAGGER_ENABLED: true,
    });
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
