import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerStorage,
  ThrottlerException,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import type { AuthenticatedSessionPrincipal } from './auth.types';

const ACCOUNT_LIMIT = 'auth-account-limit';
type AccountLimit = { limit: number; ttl: number };
export const AccountThrottle = (limit: AccountLimit) =>
  SetMetadata(ACCOUNT_LIMIT, limit);

@Injectable()
export class AuthAccountThrottleGuard implements CanActivate {
  constructor(
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedSessionPrincipal }>();
    if (!request.user?.sessionId)
      throw new UnauthorizedException('Authentication is required');
    const limit = this.reflector.get<AccountLimit>(
      ACCOUNT_LIMIT,
      context.getHandler(),
    );
    const key = createHash('sha256')
      .update(`auth-account:${context.getHandler().name}:${request.user.id}`)
      .digest('hex');
    const result = await this.storage.increment(
      key,
      limit.ttl,
      limit.limit,
      limit.ttl,
      'auth-account',
    );
    if (result.isBlocked) {
      context
        .switchToHttp()
        .getResponse<Response>()
        .header('Retry-After', String(result.timeToBlockExpire));
      throw new ThrottlerException();
    }
    return true;
  }
}
