import { z } from 'zod';
import { validateFrontendEnvironment } from './environment';

const serverTopologySchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  NEXT_API_UPSTREAM_URL: z.string().min(1).optional(),
});

const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

function formatValidationError(prefix: string, error: z.ZodError): Error {
  const details = error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  return new Error(`${prefix}: ${details}`);
}

function isLocalUrl(url: URL): boolean {
  return localHosts.has(url.hostname);
}

function validateUpstreamUrl(value: string, nodeEnvironment: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('NEXT_API_UPSTREAM_URL must be a valid URL');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('NEXT_API_UPSTREAM_URL must use HTTP or HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('NEXT_API_UPSTREAM_URL must not include credentials');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(
      'NEXT_API_UPSTREAM_URL must contain only the upstream origin',
    );
  }
  if (
    nodeEnvironment === 'production' &&
    !isLocalUrl(url) &&
    url.protocol !== 'https:'
  ) {
    throw new Error(
      'NEXT_API_UPSTREAM_URL must use HTTPS outside local development hosts in production',
    );
  }

  return url.origin;
}

export type ApiTopology = {
  publicApiUrl: string;
  upstreamUrl?: string;
  rewriteDestination?: string;
};

export function validateApiTopology(
  environment: Record<string, unknown>,
): ApiTopology {
  const frontendEnvironment = validateFrontendEnvironment({
    NEXT_PUBLIC_API_URL: environment.NEXT_PUBLIC_API_URL,
  });
  const serverResult = serverTopologySchema.safeParse({
    NODE_ENV: environment.NODE_ENV,
    NEXT_API_UPSTREAM_URL: environment.NEXT_API_UPSTREAM_URL,
  });

  if (!serverResult.success) {
    throw formatValidationError(
      'Frontend server topology validation failed',
      serverResult.error,
    );
  }

  const { NODE_ENV: nodeEnvironment, NEXT_API_UPSTREAM_URL: upstreamValue } =
    serverResult.data;

  if (!upstreamValue) {
    return {
      publicApiUrl: frontendEnvironment.NEXT_PUBLIC_API_URL,
    };
  }

  const upstreamUrl = validateUpstreamUrl(upstreamValue, nodeEnvironment);
  const publicUrl = new URL(frontendEnvironment.NEXT_PUBLIC_API_URL);

  if (!['/api', '/api/'].includes(publicUrl.pathname)) {
    throw new Error(
      'NEXT_PUBLIC_API_URL must end at /api when NEXT_API_UPSTREAM_URL is configured',
    );
  }
  if (publicUrl.search || publicUrl.hash) {
    throw new Error(
      'NEXT_PUBLIC_API_URL must not include a query or hash for same-origin API routing',
    );
  }
  if (
    nodeEnvironment === 'production' &&
    !isLocalUrl(publicUrl) &&
    publicUrl.protocol !== 'https:'
  ) {
    throw new Error(
      'NEXT_PUBLIC_API_URL must use HTTPS outside local development hosts in production',
    );
  }

  return {
    publicApiUrl: frontendEnvironment.NEXT_PUBLIC_API_URL,
    upstreamUrl,
    rewriteDestination: `${upstreamUrl}/:path*`,
  };
}
