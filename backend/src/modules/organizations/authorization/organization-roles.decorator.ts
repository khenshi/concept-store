import { SetMetadata } from '@nestjs/common';
import type { OrganizationRole } from '../../../generated/prisma/client';

export const ORGANIZATION_ROLES_KEY = 'organizationRoles';

export const OrganizationRoles = (...roles: OrganizationRole[]) =>
  SetMetadata(ORGANIZATION_ROLES_KEY, roles);
