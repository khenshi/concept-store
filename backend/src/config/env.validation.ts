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
    EMAIL_PROVIDER: z.enum(['disabled', 'resend']).default('disabled'),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().trim().min(3).max(320).optional(),
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (value) => /^postgres(?:ql)?:\/\//.test(value),
        'DATABASE_URL must use the postgresql or postgres protocol',
      ),
    DIRECT_DATABASE_URL: z
      .string()
      .url()
      .refine(
        (value) => /^postgres(?:ql)?:\/\//.test(value),
        'DIRECT_DATABASE_URL must use the postgresql or postgres protocol',
      )
      .optional(),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    DB_POOL_IDLE_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(30_000),
    DB_CONNECTION_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(60_000)
      .default(10_000),
    DB_QUERY_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(120_000)
      .default(30_000),
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
      .optional(),
    LOG_HTTP_REQUESTS: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .transform((value) => value === true || value === 'true')
      .optional(),
    LOG_DB_QUERIES: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .transform((value) => value === true || value === 'true')
      .optional(),
    LOG_DB_QUERY_PARAMETERS: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .transform((value) => value === true || value === 'true')
      .default(false),
    JWT_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    REFRESH_COOKIE_PATH: z.enum(['/auth', '/api/auth']).default('/auth'),
    SWAGGER_ENABLED: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .transform((value) => value === true || value === 'true')
      .optional(),
  })
  .passthrough()
  .superRefine((environment, context) => {
    if (environment.EMAIL_PROVIDER === 'resend') {
      if (!environment.RESEND_API_KEY) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['RESEND_API_KEY'],
          message: 'Required when EMAIL_PROVIDER is resend',
        });
      }
      if (!environment.EMAIL_FROM) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_FROM'],
          message: 'Required when EMAIL_PROVIDER is resend',
        });
      }
    }
    if (
      environment.NODE_ENV === 'production' &&
      environment.EMAIL_PROVIDER !== 'resend'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EMAIL_PROVIDER'],
        message: 'Production must use the resend email provider',
      });
    }
    if (environment.NODE_ENV !== 'production') return;
    for (const key of ['SWAGGER_ENABLED', 'LOG_DB_QUERY_PARAMETERS'] as const) {
      if (environment[key]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: 'Must remain disabled in production',
        });
      }
    }
  });

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
    LOG_LEVEL:
      result.data.LOG_LEVEL ??
      (result.data.NODE_ENV === 'development' ? 'debug' : 'info'),
    LOG_HTTP_REQUESTS:
      result.data.LOG_HTTP_REQUESTS ?? result.data.NODE_ENV === 'development',
    LOG_DB_QUERIES:
      result.data.LOG_DB_QUERIES ?? result.data.NODE_ENV === 'development',
    SWAGGER_ENABLED:
      result.data.SWAGGER_ENABLED ?? result.data.NODE_ENV !== 'production',
  };
}
