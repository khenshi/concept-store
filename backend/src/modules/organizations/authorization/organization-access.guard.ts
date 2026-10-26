import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import type { OrganizationRole } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { AuthenticatedPrincipal } from '../../auth/auth.types';
import type { OrganizationContext } from './organization-authorization.types';
import { ORGANIZATION_ROLES_KEY } from './organization-roles.decorator';
import { ALLOW_INACTIVE_REPLAY } from './allow-inactive-replay.decorator';

type OrganizationRequest = Request & {
  user: AuthenticatedPrincipal;
  organizationContext?: OrganizationContext;
};

@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OrganizationRequest>();
    const organizationId = request.params.organizationId;

    if (typeof organizationId !== 'string' || !isUUID(organizationId, '4')) {
      throw new BadRequestException('Organization ID must be a valid UUID');
    }

    if (request.user.emailVerified !== true) {
      throw new ForbiddenException(
        'Verify your email before accessing an organization workspace',
      );
    }

    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: request.user.id,
        },
      },
      select: {
        role: true,
        merchantId: true,
        organization: { select: { status: true } },
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found');
    }

    const allowedRoles = this.reflector.getAllAndOverride<OrganizationRole[]>(
      ORGANIZATION_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (allowedRoles?.length && !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        'Your organization role cannot perform this action',
      );
    }

    if (
      membership.organization.status === 'INACTIVE' &&
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      !this.reflector.get<boolean>(ALLOW_INACTIVE_REPLAY, context.getHandler())
    ) {
      throw new ForbiddenException(
        'This organization is inactive and currently read-only',
      );
    }

    request.organizationContext = {
      organizationId,
      userId: request.user.id,
      role: membership.role,
      merchantId: membership.merchantId ?? null,
      status: membership.organization.status,
    };
    return true;
  }
}
