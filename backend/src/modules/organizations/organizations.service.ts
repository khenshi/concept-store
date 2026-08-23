import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationRole } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { OrganizationAccess } from './organizations.types';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(
    userId: string,
    dto: CreateOrganizationDto,
  ): Promise<OrganizationAccess> {
    return this.prisma.$transaction(async (transaction) => {
      const organization = await transaction.organization.create({
        data: { name: dto.name },
      });
      const membership = await transaction.organizationMembership.create({
        data: {
          organizationId: organization.id,
          userId,
          role: OrganizationRole.OWNER,
        },
      });

      return { ...organization, role: membership.role };
    });
  }

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
}
