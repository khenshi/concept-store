import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import type { IncomingMessage } from 'node:http';
import type { LoggerOptions } from 'pino';

const safeLogMethod: NonNullable<
  NonNullable<LoggerOptions['hooks']>['logMethod']
> = function (args, method) {
  const first: unknown = args[0];
  if (first && typeof first === 'object') {
    args[0] =
      first instanceof Error
        ? { err: safeLogValue(first) }
        : safeLogValue(first);
  }
  method.apply(this, args);
};

const SENSITIVE_FIELDS = new Set([
  'accesstoken',
  'authorization',
  'body',
  'command',
  'cookie',
  'databaseurl',
  'directdatabaseurl',
  'email',
  'headers',
  'jwtsecret',
  'password',
  'passwordhash',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'phone',
  'reference',
  'referencenumber',
  'paymentreference',
  'refreshtoken',
  'refreshtokenhash',
  'secret',
  'setcookie',
  'stack',
  'token',
]);

function safeLogValue(value: unknown, depth = 0): unknown {
  if (value instanceof Error) {
    return { type: 'Error', message: 'Internal operation failed' };
  }
  if (!value || typeof value !== 'object') return value;
  if (depth >= 8) return '[Redacted]';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value))
    return value.map((item) => safeLogValue(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const normalized = key.toLowerCase().replace(/[^a-z]/g, '');
      if (SENSITIVE_FIELDS.has(normalized)) return [key, '[Redacted]'];
      if (['err', 'error', 'cause'].includes(normalized)) {
        return [key, { type: 'Error', message: 'Internal operation failed' }];
      }
      if (depth === 0 && ['req', 'res'].includes(key)) return [key, item];
      return [key, safeLogValue(item, depth + 1)];
    }),
  );
}

const SAFE_QUERY_KEYS = new Set([
  'page',
  'limit',
  'status',
  'sortBy',
  'sortOrder',
]);

export function sanitizeRequestUrl(url: string | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url, 'http://local');
    parsed.pathname = parsed.pathname.replace(
      /(\/organization-invitations\/)[^/]+/gi,
      '$1[Redacted]',
    );
    parsed.pathname = parsed.pathname.replace(
      /(\/auth\/(?:reset-password|password-reset|verify-email|email-verification)\/)[^/]+/gi,
      '$1[Redacted]',
    );
    for (const key of parsed.searchParams.keys()) {
      if (!SAFE_QUERY_KEYS.has(key)) {
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
    enabled: true,
    autoLogging: config.getOrThrow<boolean>('LOG_HTTP_REQUESTS'),
    hooks: { logMethod: safeLogMethod },
    genReqId(request: IncomingMessage) {
      const supplied = request.headers['x-request-id'];
      return typeof supplied === 'string' && supplied.length <= 128
        ? supplied
        : randomUUID();
    },
    serializers: {
      err() {
        return { type: 'Error', message: 'Internal operation failed' };
      },
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
