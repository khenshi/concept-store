import {
  lockSpaceMerchant,
  releaseMerchantSpaces,
} from '../spaces/space-occupancy';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, MerchantBranchStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { branchScope, merchantScope } from '../authorization/resource-access';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import type { ListMerchantBranchesDto } from './dto/merchant-branch.dto';

export const merchantBranchSelect = {
  id: true,
  organizationId: true,
  merchantId: true,
  branchId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, name: true, code: true } },
  merchant: { select: { id: true, name: true, code: true, status: true } },
} satisfies Prisma.MerchantBranchSelect;

@Injectable()
export class MerchantBranchesService {
  constructor(private readonly prisma: PrismaService) {}

  private async current(
    tx: Prisma.TransactionClient,
    context: OrganizationContext,
    ownerOnly = false,
  ) {
    const member = await tx.organizationMembership.findFirst({
      where: {
        organizationId: context.organizationId,
        userId: context.userId,
        user: { deletedAt: null },
      },
      select: { role: true, merchantId: true },
    });
    if (!member)
      throw new NotFoundException('Organization membership not found');
    if (
      ownerOnly
        ? member.role !== 'OWNER'
        : !['OWNER', 'MANAGER', 'MERCHANT'].includes(member.role)
    )
      throw new ForbiddenException(
        'Your role cannot manage merchant–branch associations',
      );
    return { ...context, ...member };
  }

  async list(
    context: OrganizationContext,
    kind: 'merchant' | 'branch',
    id: string,
    query: ListMerchantBranchesDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.current(tx, context);
        const organizationId = current.organizationId;
        if (kind === 'merchant') {
          if (
            !(await tx.merchant.findFirst({
              where: { AND: [merchantScope(current), { id }] },
              select: { id: true },
            }))
          )
            throw new NotFoundException('Merchant not found');
        } else if (
          !(await tx.branch.findFirst({
            where: { AND: [branchScope(current), { id }] },
            select: { id: true },
          }))
        )
          throw new NotFoundException('Branch not found');
        const q = query.q?.trim();
        const related = q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { code: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {};
        const where: Prisma.MerchantBranchWhereInput = {
          organizationId,
          ...(kind === 'merchant'
            ? {
                merchantId: id,
                branch: { AND: [branchScope(current), related] },
              }
            : {
                branchId: id,
                merchant: { AND: [merchantScope(current), related] },
              }),
          ...(query.status ? { status: query.status } : {}),
        };
        const total = await tx.merchantBranch.count({ where });
        const items = await tx.merchantBranch.findMany({
          where,
          select: merchantBranchSelect,
          orderBy:
            kind === 'merchant'
              ? [{ branch: { name: 'asc' } }, { id: 'asc' }]
              : [{ merchant: { name: 'asc' } }, { id: 'asc' }],
          skip: (query.page - 1) * 10,
          take: 10,
        });
        return {
          items,
          page: query.page,
          limit: 10,
          total,
          totalPages: Math.ceil(total / 10),
          hasNext: query.page * 10 < total,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async assign(
    context: OrganizationContext,
    merchantId: string,
    branchId: string,
  ) {
    return this.mutate(context, async (tx) => {
      const organizationId = context.organizationId;
      if (
        !(await tx.merchant.findUnique({
          where: { id_organizationId: { id: merchantId, organizationId } },
          select: { id: true },
        }))
      )
        throw new NotFoundException('Merchant not found');
      if (
        !(await tx.branch.findUnique({
          where: { id_organizationId: { id: branchId, organizationId } },
          select: { id: true },
        }))
      )
        throw new NotFoundException('Branch not found');
      return tx.merchantBranch.upsert({
        where: {
          organizationId_branchId_merchantId: {
            organizationId,
            branchId,
            merchantId,
          },
        },
        create: { organizationId, branchId, merchantId },
        update: {},
        select: merchantBranchSelect,
      });
    });
  }

  async setStatus(
    context: OrganizationContext,
    merchantId: string,
    branchId: string,
    status: MerchantBranchStatus,
  ) {
    return this.mutate(context, async (tx) => {
      const organizationId = context.organizationId;
      await lockSpaceMerchant(tx, organizationId, merchantId);
      const locked = await tx.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "MerchantBranch" WHERE "organizationId" = ${organizationId} AND "branchId" = ${branchId} AND "merchantId" = ${merchantId} FOR UPDATE`;
      if (!locked.length)
        throw new NotFoundException('Merchant–branch association not found');
      if (status === 'INACTIVE')
        await releaseMerchantSpaces(
          tx,
          organizationId,
          merchantId,
          context.userId,
          'PARTICIPATION_INACTIVE',
          branchId,
        );
      return tx.merchantBranch.update({
        where: { id: locked[0].id },
        data: { status },
        select: merchantBranchSelect,
      });
    });
  }

  private async mutate<T>(
    context: OrganizationContext,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "userId" FROM "OrganizationMembership" WHERE "organizationId" = ${context.organizationId} AND "userId" = ${context.userId} FOR UPDATE`;
          await this.current(tx, context, true);
          return work(tx);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const adapter =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? (error.meta?.driverAdapterError as
              { cause?: { originalCode?: string } } | undefined)
          : undefined;
      const databaseCode =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        typeof error.meta?.code === 'string'
          ? error.meta.code
          : adapter?.cause?.originalCode;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (['P2002', 'P2034'].includes(error.code) ||
          (error.code === 'P2010' &&
            ['40001', '40P01'].includes(databaseCode ?? '')))
      )
        throw new ConflictException(
          'Association changed concurrently; refresh and retry',
        );
      throw error;
    }
  }
}
