import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';
import { EmailService } from './email.service';

describe('EmailService', () => {
  const warn = jest.fn();
  const logger = {
    setContext: jest.fn(),
    warn,
    error: jest.fn(),
  } as unknown as PinoLogger;

  function createService(
    values: Record<string, string | undefined>,
  ): EmailService {
    const config = {
      getOrThrow: jest.fn((key: string) => {
        const value = values[key];
        if (value === undefined) throw new Error(`Missing ${key}`);
        return value;
      }),
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
    return new EmailService(config, logger);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not call Resend when email delivery is disabled', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const service = createService({
      EMAIL_PROVIDER: 'disabled',
      FRONTEND_ORIGIN: 'http://localhost:3001',
    });

    await expect(
      service.sendVerificationEmail({
        to: 'owner@example.com',
        firstName: 'Maria',
        token: 'token',
      }),
    ).resolves.toEqual({ status: 'disabled' });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('sends a verification message through the Resend API', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 202,
    } as Response);
    const service = createService({
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'Kapwesto <no-reply@example.com>',
      FRONTEND_ORIGIN: 'https://app.example.com/',
    });

    await expect(
      service.sendVerificationEmail({
        to: 'owner@example.com',
        firstName: '<Maria>',
        token: 'token',
      }),
    ).resolves.toEqual({ status: 'accepted' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer re_test',
          'Content-Type': 'application/json',
        },
      }) as unknown,
    );
    const request = fetchMock.mock.calls[0]?.[1];
    if (!request || typeof request.body !== 'string') {
      throw new Error('Expected a JSON email request body');
    }
    expect(request.body).toContain(
      'https://app.example.com/verify-email?token=token',
    );
    const body = JSON.parse(request.body) as { html: string };
    expect(body.html).toContain('&lt;Maria&gt;');
    expect(body.html).not.toContain('<Maria>');
    fetchMock.mockRestore();
  });

  it('returns a failed status when Resend rejects the message', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);
    const service = createService({
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'Kapwesto <no-reply@example.com>',
      FRONTEND_ORIGIN: 'https://app.example.com',
    });

    await expect(
      service.sendPasswordResetEmail({
        to: 'owner@example.com',
        firstName: 'Maria',
        token: 'token',
      }),
    ).resolves.toEqual({ status: 'failed' });
    expect(warn).toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});
