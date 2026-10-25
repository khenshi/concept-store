import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationRole } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { OrganizationAccess } from './organizations.types';
import { assertActiveOrganization } from './organization-state';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string): Promise<OrganizationAccess[]> {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { organization: { createdAt: 'asc' } },
    });

    return memberships.map(({ organization, role }) => ({
      ...organization,
      role,
    }));
  }

  async findOneForUser(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationAccess> {
    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      include: { organization: true },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found');
    }

    return { ...membership.organization, role: membership.role };
  }

  async rename(
    organizationId: string,
    name: string,
  ): Promise<OrganizationAccess> {
    const organization = await this.prisma.$transaction(async (transaction) => {
      await assertActiveOrganization(transaction, organizationId);
      return transaction.organization.update({
        where: { id: organizationId },
        data: { name },
      });
    });
    return { ...organization, role: OrganizationRole.OWNER };
  }
}
