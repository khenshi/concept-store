import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { OrganizationContext } from './organization-authorization.types';

type OrganizationRequest = Request & {
  organizationContext: OrganizationContext;
};

export const CurrentOrganization = createParamDecorator(
  (_data: unknown, context: ExecutionContext): OrganizationContext =>
    context.switchToHttp().getRequest<OrganizationRequest>()
      .organizationContext,
);
