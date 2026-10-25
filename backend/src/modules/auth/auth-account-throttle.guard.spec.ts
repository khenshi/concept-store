import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import {
  AccountThrottle,
  AuthAccountThrottleGuard,
} from './auth-account-throttle.guard';
import { AUTH_RATE_LIMITS } from '../../config/rate-limit';

describe('AuthAccountThrottleGuard', () => {
  class Routes {
    @AccountThrottle(AUTH_RATE_LIMITS.changePassword)
    changePassword(this: void) {}
    @AccountThrottle(AUTH_RATE_LIMITS.deleteAccount)
    deleteAccount(this: void) {}
  }

  it('limits an authenticated account across sessions and IPs, with separate operations and accounts', async () => {
    const storage = new ThrottlerStorageService();
    const guard = new AuthAccountThrottleGuard(storage, new Reflector());
    const header = jest.fn();
    const context = (
      userId: string,
      handler = Routes.prototype.changePassword,
      session = 'verified-session',
      ip = '127.0.0.1',
    ) =>
      ({
        getHandler: () => handler,
        switchToHttp: () => ({
          getRequest: () => ({ ip, user: { id: userId, sessionId: session } }),
          getResponse: () => ({ header }),
        }),
      }) as unknown as ExecutionContext;
    try {
      for (let i = 0; i < 5; i++)
        await expect(
          guard.canActivate(
            context(
              'account',
              Routes.prototype.changePassword,
              `session-${i}`,
              `192.0.2.${i}`,
            ),
          ),
        ).resolves.toBe(true);
      await expect(
        guard.canActivate(context('account')),
      ).rejects.toBeInstanceOf(ThrottlerException);
      expect(header).toHaveBeenCalledWith('Retry-After', expect.any(String));
      await expect(guard.canActivate(context('other-account'))).resolves.toBe(
        true,
      );
      await expect(
        guard.canActivate(context('account', Routes.prototype.deleteAccount)),
      ).resolves.toBe(true);
      await expect(
        guard.canActivate(
          context('account', Routes.prototype.changePassword, ''),
        ),
      ).rejects.toThrow('Authentication is required');
    } finally {
      storage.onApplicationShutdown();
    }
  });
});
