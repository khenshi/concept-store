import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { OrganizationRole, Prisma } from '../../../generated/prisma/client';
import type { AddOrganizationMemberDto } from './dto/add-organization-member.dto';
import type { UpdateOrganizationMemberRoleDto } from './dto/update-organization-member-role.dto';
import type { OrganizationMember } from './organization-memberships.types';

@Injectable()
export class OrganizationMembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string): Promise<OrganizationMember[]> {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { organizationId },
      select: {
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map(({ user, role, createdAt }) => ({
      ...user,
      role,
      joinedAt: createdAt,
    }));
  }

  async add(
    organizationId: string,
    dto: AddOrganizationMemberDto,
  ): Promise<OrganizationMember> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      const membership = await this.prisma.organizationMembership.create({
        data: { organizationId, userId: user.id, role: dto.role },
        select: { role: true, createdAt: true },
      });

      return {
        ...user,
        role: membership.role,
        joinedAt: membership.createdAt,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User is already an organization member');
      }

      throw error;
    }
  }

  updateRole(
    organizationId: string,
    userId: string,
    dto: UpdateOrganizationMemberRoleDto,
  ): Promise<OrganizationMember> {
    return this.withOwnerInvariant(async (transaction) => {
      const membership = await this.findMembership(
        transaction,
        organizationId,
        userId,
      );

      if (
        membership.role === OrganizationRole.OWNER &&
        dto.role !== OrganizationRole.OWNER
      ) {
        await this.assertAnotherOwnerExists(transaction, organizationId);
      }

      const updated = await transaction.organizationMembership.update({
        where: { organizationId_userId: { organizationId, userId } },
        data: { role: dto.role },
        select: { role: true, createdAt: true },
      });

      return {
        ...membership.user,
        role: updated.role,
        joinedAt: updated.createdAt,
      };
    });
  }

  remove(organizationId: string, userId: string): Promise<void> {
    return this.withOwnerInvariant(async (transaction) => {
      const membership = await this.findMembership(
        transaction,
        organizationId,
        userId,
      );

      if (membership.role === OrganizationRole.OWNER) {
        await this.assertAnotherOwnerExists(transaction, organizationId);
      }

      await transaction.organizationMembership.delete({
        where: { organizationId_userId: { organizationId, userId } },
      });
    });
  }

  private async findMembership(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
  ) {
    const membership = await transaction.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: {
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization member not found');
    }

    return membership;
  }

  private async assertAnotherOwnerExists(
    transaction: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<void> {
    const ownerCount = await transaction.organizationMembership.count({
      where: { organizationId, role: OrganizationRole.OWNER },
    });

    if (ownerCount <= 1) {
      throw new ConflictException(
        'An organization must retain at least one owner',
      );
    }
  }

  private async withOwnerInvariant<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Membership changed concurrently; retry the request',
        );
      }

      throw error;
    }
  }
}
