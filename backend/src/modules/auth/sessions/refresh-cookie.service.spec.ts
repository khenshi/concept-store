import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { RefreshCookieService } from './refresh-cookie.service';

describe('RefreshCookieService', () => {
  async function createService(
    environment: string,
    path: '/auth' | '/api/auth' = '/auth',
  ) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RefreshCookieService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) =>
              key === 'NODE_ENV' ? environment : path,
            ),
          },
        },
      ],
    }).compile();
    return moduleRef.get(RefreshCookieService);
  }

  it('writes an HTTP-only production cookie scoped to auth routes', async () => {
    const service = await createService('production');
    const cookie = jest.fn();
    const response = { cookie } as unknown as Response;
    const expiresAt = new Date('2026-09-22T00:00:00.000Z');

    service.write(response, {
      id: 'session-id',
      token: 'refresh-token',
      expiresAt,
    });

    expect(cookie).toHaveBeenCalledWith(
      'concept_store_refresh',
      'refresh-token',
      {
        expires: expiresAt,
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/auth',
      },
    );
  });

  it('reads the refresh cookie', async () => {
    const service = await createService('development');
    const request: Pick<Request, 'cookies'> = {
      cookies: { concept_store_refresh: 'refresh-token' },
    };

    expect(service.read(request as Request)).toBe('refresh-token');
  });

  it('uses the public proxy path when configured', async () => {
    const service = await createService('production', '/api/auth');
    const cookie = jest.fn();
    const response = { cookie } as unknown as Response;

    service.write(response, {
      id: 'session-id',
      token: 'refresh-token',
      expiresAt: new Date('2026-09-22T00:00:00.000Z'),
    });

    const calls = cookie.mock.calls as unknown as Array<
      [string, string, { path: string }]
    >;
    expect(calls[0]?.[2]).toMatchObject({ path: '/api/auth' });
  });
});
