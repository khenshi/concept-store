import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    FRONTEND_ORIGIN: z
      .string()
      .url()
      .refine(
        (value) => ['http:', 'https:'].includes(new URL(value).protocol),
        'FRONTEND_ORIGIN must use HTTP or HTTPS',
      ),
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (value) => /^postgres(?:ql)?:\/\//.test(value),
        'DATABASE_URL must use the postgresql or postgres protocol',
      ),
    JWT_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    SWAGGER_ENABLED: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .transform((value) => value === true || value === 'true')
      .optional(),
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

  return {
    ...result.data,
    SWAGGER_ENABLED:
      result.data.SWAGGER_ENABLED ?? result.data.NODE_ENV !== 'production',
  };
}
