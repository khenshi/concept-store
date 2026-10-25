import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from './auth.types';

type VerifiedRequest = Request & { user: AuthenticatedPrincipal };

@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<VerifiedRequest>();
    if (request.user.emailVerified !== true) {
      throw new ForbiddenException(
        'Verify your email before accessing an organization workspace',
      );
    }
    return true;
  }
}
