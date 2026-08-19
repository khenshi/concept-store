import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  const requiredEnvironment = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/concept_store',
    JWT_SECRET: 'a-secure-test-secret-with-at-least-32-characters',
  };

  it('applies safe defaults and coerces environment values', () => {
    expect(
      validateEnvironment({ ...requiredEnvironment, PORT: '4000' }),
    ).toMatchObject({
      ...requiredEnvironment,
      NODE_ENV: 'development',
      PORT: 4000,
    });
  });

  it('rejects a non-PostgreSQL database URL', () => {
    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        DATABASE_URL: 'mysql://localhost/concept_store',
      }),
    ).toThrow('DATABASE_URL must use the postgresql or postgres protocol');
  });

  it('reports all invalid required configuration', () => {
    expect(() =>
      validateEnvironment({ DATABASE_URL: 'invalid', JWT_SECRET: 'short' }),
    ).toThrow(/DATABASE_URL.*JWT_SECRET/);
  });
});
