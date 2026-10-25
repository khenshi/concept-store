import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedSessionPrincipal } from './auth.types';

type AuthenticatedRequest = Request & { user: AuthenticatedSessionPrincipal };

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedSessionPrincipal =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
