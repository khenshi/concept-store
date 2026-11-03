import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MemberAccessEventOperation,
  OrganizationRole,
  Prisma,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { UpdateOrganizationMemberRoleDto } from './dto/update-organization-member-role.dto';
import type { ListMemberAccessHistoryQueryDto } from './dto/list-member-access-history-query.dto';
import type { ListMembersQueryDto } from './dto/list-members-query.dto';
import { ORGANIZATION_PAGE_SIZE } from '../dto/page-query.dto';
import type {
  MemberAccessEventPage,
  OrganizationMember,
  OrganizationMemberPage,
} from './organization-memberships.types';
import { assertActiveOrganization } from '../organization-state';
import { assertBranchWriteAllowed } from '../branch-lifecycle';

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
            : member.role === OrganizationRole.MERCHANT
              ? {
                  merchants: {
                    some: {
                      organizationId,
                      merchantId: member.merchantId ?? '',
                    },
                  },
                }
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
    actorId = userId,
  ): Promise<void> {
    return this.withOwnerInvariant(async (tx) => {
      await assertActiveOrganization(tx, organizationId);
      const member = await this.findMembership(tx, organizationId, userId);
      if (member.role === OrganizationRole.MERCHANT)
        throw new ConflictException(
          'Merchant users inherit branch access from their profile; manage merchant–branch associations instead',
        );
      if (member.role === OrganizationRole.OWNER)
        throw new ConflictException(
          'Owners have implicit access to all branches',
        );
      await assertBranchWriteAllowed(tx, organizationId, branchId, {
        allowInactive: !grant,
      });
      const before = memberState(member);
      const branchIds = new Set(before.branchIds);
      if (grant) branchIds.add(branchId);
      else branchIds.delete(branchId);
      const after = { ...before, branchIds: [...branchIds].sort() };
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
      if (!sameState(before, after))
        await this.recordAccessEvent(
          tx,
          organizationId,
          actorId,
          member,
          grant
            ? MemberAccessEventOperation.BRANCH_GRANTED
            : MemberAccessEventOperation.BRANCH_REVOKED,
          before,
          after,
        );
    });
  }

  setMerchant(
    organizationId: string,
    userId: string,
    merchantId: string,
    actorId = userId,
  ) {
    return this.withOwnerInvariant(async (tx) => {
      const member = await this.findMembership(tx, organizationId, userId);
      if (member.role !== OrganizationRole.MERCHANT)
        throw new ConflictException(
          'Only merchant members can have a merchant link',
        );
      await this.assertMerchant(tx, organizationId, merchantId);
      const before = memberState(member);
      await tx.organizationMembership.update({
        where: { organizationId_userId: { organizationId, userId } },
        data: { merchantId },
      });
      const after = { ...before, merchantId };
      if (!sameState(before, after))
        await this.recordAccessEvent(
          tx,
          organizationId,
          actorId,
          member,
          MemberAccessEventOperation.MERCHANT_LINKED,
          before,
          after,
        );
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

  async findAll(
    organizationId: string,
    query: ListMembersQueryDto = { page: 1 },
  ): Promise<OrganizationMemberPage> {
    const where: Prisma.OrganizationMembershipWhereInput = {
      organizationId,
      ...(query.q
        ? {
            user: {
              OR: [
                { firstName: { contains: query.q, mode: 'insensitive' } },
                { lastName: { contains: query.q, mode: 'insensitive' } },
                { email: { contains: query.q, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const skip = (query.page - 1) * ORGANIZATION_PAGE_SIZE;
    const [total, memberships] = await this.prisma.$transaction([
      this.prisma.organizationMembership.count({ where }),
      this.prisma.organizationMembership.findMany({
        where,
        select: {
          role: true,
          merchantId: true,
          createdAt: true,
          _count: { select: { branches: true } },
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
        orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
        skip,
        take: ORGANIZATION_PAGE_SIZE,
      }),
    ]);

    return {
      items: memberships.map(
        ({ user, role, merchantId, createdAt, _count }) => ({
          ...user,
          role,
          merchantId,
          branchAccessCount: _count.branches,
          joinedAt: createdAt,
        }),
      ),
      page: query.page,
      limit: ORGANIZATION_PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / ORGANIZATION_PAGE_SIZE),
      hasNext: query.page * ORGANIZATION_PAGE_SIZE < total,
    };
  }

  async findAccessHistory(
    organizationId: string,
    query: ListMemberAccessHistoryQueryDto,
  ): Promise<MemberAccessEventPage> {
    const where = {
      organizationId,
      ...(query.userId ? { targetUserId: query.userId } : {}),
    };
    const skip = (query.page - 1) * ORGANIZATION_PAGE_SIZE;
    const [total, events] = await this.prisma.$transaction([
      this.prisma.memberAccessEvent.count({ where }),
      this.prisma.memberAccessEvent.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip,
        take: ORGANIZATION_PAGE_SIZE,
      }),
    ]);
    return {
      items: events,
      page: query.page,
      limit: ORGANIZATION_PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / ORGANIZATION_PAGE_SIZE),
      hasNext: query.page * ORGANIZATION_PAGE_SIZE < total,
    };
  }

  updateRole(
    organizationId: string,
    userId: string,
    dto: UpdateOrganizationMemberRoleDto,
    actorId = userId,
  ): Promise<OrganizationMember> {
    return this.withOwnerInvariant(async (transaction) => {
      await assertActiveOrganization(transaction, organizationId);
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
      const before = memberState(membership);

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
        select: {
          role: true,
          merchantId: true,
          createdAt: true,
          _count: { select: { branches: true } },
        },
      });

      const after = {
        role: updated.role,
        merchantId: updated.merchantId,
        branchIds:
          updated.role === OrganizationRole.OWNER ||
          updated.role === OrganizationRole.MERCHANT
            ? []
            : before.branchIds,
      };
      if (!sameState(before, after))
        await this.recordAccessEvent(
          transaction,
          organizationId,
          actorId,
          membership,
          before.role !== after.role
            ? MemberAccessEventOperation.ROLE_CHANGED
            : after.merchantId
              ? MemberAccessEventOperation.MERCHANT_LINKED
              : MemberAccessEventOperation.MERCHANT_UNLINKED,
          before,
          after,
        );

      return {
        ...membership.user,
        role: updated.role,
        merchantId: updated.merchantId,
        branchAccessCount: updated._count.branches,
        joinedAt: updated.createdAt,
      };
    });
  }

  remove(
    organizationId: string,
    userId: string,
    actorId = userId,
  ): Promise<void> {
    return this.withOwnerInvariant(async (transaction) => {
      await assertActiveOrganization(transaction, organizationId);
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
      await this.recordAccessEvent(
        transaction,
        organizationId,
        actorId,
        membership,
        MemberAccessEventOperation.MEMBER_REMOVED,
        memberState(membership),
        { role: null, merchantId: null, branchIds: [] },
      );
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
        branches: { select: { branchId: true }, orderBy: { branchId: 'asc' } },
      },
    });

    if (!membership)
      throw new NotFoundException('Organization member not found');
    return membership;
  }

  private async recordAccessEvent(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    actorId: string,
    member: {
      user: { id: string; firstName: string; lastName: string };
    },
    operation: MemberAccessEventOperation,
    beforeState: MemberAccessState,
    afterState: MemberAccessState,
  ) {
    const actor = await transaction.organizationMembership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: actorId },
      },
      select: {
        user: { select: { firstName: true, lastName: true } },
      },
    });
    await transaction.memberAccessEvent.create({
      data: {
        organizationId,
        operation,
        actorId,
        targetUserId: member.user.id,
        actorName: actor
          ? `${actor.user.firstName} ${actor.user.lastName}`.trim()
          : actorId,
        targetName: `${member.user.firstName} ${member.user.lastName}`.trim(),
        beforeState,
        afterState,
      },
    });
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
      const adapterError =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? (error.meta?.driverAdapterError as
              { cause?: { originalCode?: string } } | undefined)
          : undefined;
      const postgresCode =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        typeof error.meta?.code === 'string'
          ? error.meta.code
          : adapterError?.cause?.originalCode;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' ||
          (error.code === 'P2010' &&
            ['40001', '40P01'].includes(postgresCode ?? '')))
      ) {
        throw new ConflictException(
          'Membership changed concurrently; retry the request',
        );
      }
      throw error;
    }
  }
}

type MemberAccessState = {
  role: OrganizationRole | null;
  merchantId: string | null;
  branchIds: string[];
};

function memberState(member: {
  role: OrganizationRole;
  merchantId: string | null;
  branches?: { branchId: string }[];
}): MemberAccessState {
  return {
    role: member.role,
    merchantId: member.merchantId,
    branchIds: (member.branches ?? []).map(({ branchId }) => branchId).sort(),
  };
}

function sameState(left: MemberAccessState, right: MemberAccessState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
