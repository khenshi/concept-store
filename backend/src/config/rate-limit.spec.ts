/* eslint-disable @typescript-eslint/unbound-method -- decorators store metadata on prototype methods */
import { Reflector } from '@nestjs/core';
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';
import { AuthController } from '../modules/auth/auth.controller';
import { InvitationAcceptanceController } from '../modules/organizations/invitations/invitation-acceptance.controller';
import { AUTH_RATE_LIMITS, INVITATION_RATE_LIMITS } from './rate-limit';

describe('sensitive endpoint rate limits', () => {
  const reflector = new Reflector();
  const limitKey = `${THROTTLER_LIMIT}default`;
  const ttlKey = `${THROTTLER_TTL}default`;

  it.each([
    ['register', AuthController.prototype.register, AUTH_RATE_LIMITS.register],
    ['login', AuthController.prototype.login, AUTH_RATE_LIMITS.login],
    ['refresh', AuthController.prototype.refresh, AUTH_RATE_LIMITS.refresh],
    ['logout', AuthController.prototype.logout, AUTH_RATE_LIMITS.logout],
  ])('protects auth.%s with its configured limit', (_, handler, expected) => {
    expect(reflector.get<number>(limitKey, handler)).toBe(expected.limit);
    expect(reflector.get<number>(ttlKey, handler)).toBe(expected.ttl);
  });

  it.each([
    [
      'preview',
      InvitationAcceptanceController.prototype.preview,
      INVITATION_RATE_LIMITS.preview,
    ],
    [
      'accept',
      InvitationAcceptanceController.prototype.accept,
      INVITATION_RATE_LIMITS.accept,
    ],
  ])(
    'protects invitation %s with its configured limit',
    (_, handler, expected) => {
      expect(reflector.get<number>(limitKey, handler)).toBe(expected.limit);
      expect(reflector.get<number>(ttlKey, handler)).toBe(expected.ttl);
    },
  );
});
