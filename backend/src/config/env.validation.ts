import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (value) => /^postgres(?:ql)?:\/\//.test(value),
        'DATABASE_URL must use the postgresql or postgres protocol',
      ),
    JWT_SECRET: z.string().min(32),
  })
  .passthrough();

export function validateEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  const result = envSchema.safeParse(environment);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Environment validation failed: ${details}`);
  }

  return result.data;
}
