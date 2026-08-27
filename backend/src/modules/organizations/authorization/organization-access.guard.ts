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

    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: request.user.id,
        },
      },
      select: { role: true },
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

    request.organizationContext = {
      organizationId,
      userId: request.user.id,
      role: membership.role,
    };
    return true;
  }
}
