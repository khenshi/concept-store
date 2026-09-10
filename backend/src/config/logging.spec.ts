import type { ConfigService } from '@nestjs/config';
import { pinoHttpOptions, sanitizeRequestUrl } from './logging';

describe('logging configuration', () => {
  it('redacts sensitive query parameters while preserving ordinary filters', () => {
    expect(
      sanitizeRequestUrl(
        '/organizations?status=active&token=secret&Password=hidden',
      ),
    ).toBe(
      '/organizations?status=active&token=%5BRedacted%5D&Password=%5BRedacted%5D',
    );
  });

  it('drops the query string when a URL cannot be parsed safely', () => {
    expect(sanitizeRequestUrl('http://[invalid?token=secret')).toBe(
      'http://[invalid',
    );
  });

  it('uses configured request logging and keeps request logs minimal', () => {
    const values: Record<string, unknown> = {
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
      LOG_HTTP_REQUESTS: true,
    };
    const config = {
      getOrThrow: (key: string) => values[key],
    } as ConfigService;
    const options = pinoHttpOptions(config);

    expect(options).toMatchObject({
      level: 'debug',
      enabled: true,
      autoLogging: true,
      transport: { target: 'pino-pretty' },
    });
    expect(
      options.serializers.req({
        id: 'request-1',
        method: 'GET',
        url: '/auth/callback?access_token=secret',
        remoteAddress: '127.0.0.1',
      }),
    ).toEqual({
      id: 'request-1',
      method: 'GET',
      url: '/auth/callback?access_token=%5BRedacted%5D',
      remoteAddress: '127.0.0.1',
    });
  });

  it('accepts a bounded incoming request ID and replaces invalid values', () => {
    const config = {
      getOrThrow: (key: string) =>
        ({
          NODE_ENV: 'production',
          LOG_LEVEL: 'info',
          LOG_HTTP_REQUESTS: true,
        })[key],
    } as ConfigService;
    const options = pinoHttpOptions(config);

    expect(
      options.genReqId({
        headers: { 'x-request-id': 'test-request' },
      } as never),
    ).toBe('test-request');
    expect(
      options.genReqId({
        headers: { 'x-request-id': 'x'.repeat(129) },
      } as never),
    ).toMatch(/^[0-9a-f-]{36}$/);
  });
});
