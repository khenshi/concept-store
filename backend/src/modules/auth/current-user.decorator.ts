import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedPrincipal } from './auth.types';

type AuthenticatedRequest = Request & { user: AuthenticatedPrincipal };

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
