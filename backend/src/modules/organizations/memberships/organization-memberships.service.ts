import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationRole, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { UpdateOrganizationMemberRoleDto } from './dto/update-organization-member-role.dto';
import type { OrganizationMember } from './organization-memberships.types';

@Injectable()
export class OrganizationMembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  findBranches(organizationId: string, userId: string) {
    return this.withOwnerInvariant(async (tx) => {
      const member = await this.findMembership(tx, organizationId, userId);
      return tx.branch.findMany({
        where: {
          organizationId,
          ...(member.role === OrganizationRole.OWNER
            ? {}
            : { memberships: { some: { organizationId, userId } } }),
        },
        select: { id: true, name: true, code: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      });
    });
  }

  setBranch(
    organizationId: string,
    userId: string,
    branchId: string,
    grant: boolean,
  ): Promise<void> {
    return this.withOwnerInvariant(async (tx) => {
      const member = await this.findMembership(tx, organizationId, userId);
      if (member.role === OrganizationRole.OWNER)
        throw new ConflictException(
          'Owners have implicit access to all branches',
        );
      const branch = await tx.branch.findUnique({
        where: { id_organizationId: { id: branchId, organizationId } },
        select: { id: true },
      });
      if (!branch) throw new NotFoundException('Branch not found');
      const key = { organizationId, userId, branchId };
      if (grant) {
        await tx.branchMembership.upsert({
          where: { organizationId_branchId_userId: key },
          create: key,
          update: {},
        });
      } else {
        await tx.branchMembership.deleteMany({ where: key });
      }
    });
  }

  setMerchant(organizationId: string, userId: string, merchantId: string) {
    return this.withOwnerInvariant(async (tx) => {
      const member = await this.findMembership(tx, organizationId, userId);
      if (member.role !== OrganizationRole.MERCHANT)
        throw new ConflictException(
          'Only merchant members can have a merchant link',
        );
      await this.assertMerchant(tx, organizationId, merchantId);
      await tx.organizationMembership.update({
        where: { organizationId_userId: { organizationId, userId } },
        data: { merchantId },
      });
      return { merchantId };
    });
  }

  private async assertMerchant(
    tx: Prisma.TransactionClient,
    organizationId: string,
    merchantId: string,
  ) {
    const merchant = await tx.merchant.findUnique({
      where: { id_organizationId: { id: merchantId, organizationId } },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
  }

  async findAll(organizationId: string): Promise<OrganizationMember[]> {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { organizationId },
      select: {
        role: true,
        merchantId: true,
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

    return memberships.map(({ user, role, merchantId, createdAt }) => ({
      ...user,
      role,
      merchantId,
      joinedAt: createdAt,
    }));
  }

  updateRole(
    organizationId: string,
    userId: string,
    dto: UpdateOrganizationMemberRoleDto,
  ): Promise<OrganizationMember> {
    return this.withOwnerInvariant(async (transaction) => {
      if (
        dto.role !== OrganizationRole.MERCHANT &&
        dto.merchantId !== undefined
      )
        throw new BadRequestException(
          'merchantId is only allowed for MERCHANT role',
        );
      if (dto.role === OrganizationRole.MERCHANT && !dto.merchantId)
        throw new BadRequestException('MERCHANT role requires merchantId');
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

      if (dto.role === OrganizationRole.MERCHANT)
        await this.assertMerchant(transaction, organizationId, dto.merchantId!);
      if (membership.role !== dto.role)
        await transaction.branchMembership.deleteMany({
          where: { organizationId, userId },
        });
      const updated = await transaction.organizationMembership.update({
        where: { organizationId_userId: { organizationId, userId } },
        data: {
          role: dto.role,
          merchantId:
            dto.role === OrganizationRole.MERCHANT ? dto.merchantId : null,
        },
        select: { role: true, merchantId: true, createdAt: true },
      });

      return {
        ...membership.user,
        role: updated.role,
        merchantId: updated.merchantId,
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
    // All access mutations lock the same tenant-local membership before reading.
    await transaction.$queryRaw`SELECT "userId" FROM "OrganizationMembership" WHERE "organizationId" = ${organizationId} AND "userId" = ${userId} FOR UPDATE`;
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

    if (!membership)
      throw new NotFoundException('Organization member not found');
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
