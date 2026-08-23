import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { RefreshCookieService } from './refresh-cookie.service';

describe('RefreshCookieService', () => {
  async function createService(environment: string) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RefreshCookieService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue(environment) },
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

    service.write(response, { token: 'refresh-token', expiresAt });

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
    const request = {
      cookies: { concept_store_refresh: 'refresh-token' },
    } as Request;

    expect(service.read(request)).toBe('refresh-token');
  });
});
