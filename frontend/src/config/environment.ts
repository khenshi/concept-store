import { z } from 'zod';

const frontendEnvironmentSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .string()
    .url()
    .refine(
      (value) => ['http:', 'https:'].includes(new URL(value).protocol),
      'NEXT_PUBLIC_API_URL must use HTTP or HTTPS',
    ),
});

export type FrontendEnvironment = z.infer<typeof frontendEnvironmentSchema>;

export function validateFrontendEnvironment(
  environment: Record<string, unknown>,
): FrontendEnvironment {
  const result = frontendEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Frontend environment validation failed: ${details}`);
  }

  return result.data;
}
