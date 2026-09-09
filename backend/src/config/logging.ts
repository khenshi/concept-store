import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import type { IncomingMessage } from 'node:http';

const SENSITIVE_QUERY_KEYS = new Set([
  'access_token',
  'authorization',
  'password',
  'refresh_token',
  'secret',
  'token',
]);

export function sanitizeRequestUrl(url: string | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url, 'http://local');
    for (const key of parsed.searchParams.keys()) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, '[Redacted]');
      }
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url.split('?')[0];
  }
}

export function pinoHttpOptions(config: ConfigService) {
  const isDevelopment = config.getOrThrow<string>('NODE_ENV') === 'development';
  return {
    level: config.getOrThrow<string>('LOG_LEVEL'),
    enabled: config.getOrThrow<boolean>('LOG_HTTP_REQUESTS'),
    autoLogging: true,
    genReqId(request: IncomingMessage) {
      const supplied = request.headers['x-request-id'];
      return typeof supplied === 'string' && supplied.length <= 128
        ? supplied
        : randomUUID();
    },
    serializers: {
      req(request: {
        id?: string;
        method?: string;
        url?: string;
        remoteAddress?: string;
      }) {
        return {
          id: request.id,
          method: request.method,
          url: sanitizeRequestUrl(request.url),
          remoteAddress: request.remoteAddress,
        };
      },
      res(response: { statusCode?: number }) {
        return { statusCode: response.statusCode };
      },
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers.set-cookie',
        'password',
        '*.password',
        'refreshToken',
        '*.refreshToken',
        'accessToken',
        '*.accessToken',
      ],
      censor: '[Redacted]',
    },
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
            translateTime: 'SYS:standard',
          },
        }
      : undefined,
  };
}
