import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { branchScope } from '../authorization/resource-access';
import { assertActiveOrganization } from '../organization-state';
import {
  BranchPaymentAccountsQueryDto,
  CreatePaymentAccountDto,
  PaymentAccountOperation,
  UpdatePaymentAccountDto,
} from './payment-account.dto';
import { paymentWriteConflict } from './payment-account-availability';

@Injectable()
export class PaymentAccountsService {
  constructor(private readonly prisma: PrismaService) {}
  private async current(
    tx: Prisma.TransactionClient,
    context: OrganizationContext,
    owner = true,
  ) {
    const member = await tx.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        user: { deletedAt: null, emailVerifiedAt: { not: null } },
      },
      select: { role: true },
    });
    if (!member) throw new NotFoundException('Organization not found');
    if (owner && member.role !== 'OWNER')
      throw new ForbiddenException('Only Owners can manage payment accounts');
    return { ...context, role: member.role };
  }
  private response(
    account: Prisma.PaymentAccountGetPayload<{ include: { branches: true } }>,
  ) {
    const { normalizedName: _normalizedName, branches, ...result } = account;
    void _normalizedName;
    return { ...result, branchIds: branches.map((b) => b.branchId).sort() };
  }
  list(context: OrganizationContext) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.current(tx, context);
        return (
          await tx.paymentAccount.findMany({
            where: { organizationId: context.organizationId },
            include: { branches: true },
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
          })
        ).map((a) => this.response(a));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async save(
    context: OrganizationContext,
    dto: CreatePaymentAccountDto | UpdatePaymentAccountDto,
    id?: string,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.current(tx, context);
          await assertActiveOrganization(tx, context.organizationId);
          if (id) {
            await tx.$queryRaw(
              Prisma.sql`SELECT "id" FROM "PaymentAccount" WHERE "organizationId" = ${context.organizationId} AND "id" = ${id} FOR UPDATE`,
            );
            const original = await tx.paymentAccount.findFirst({
              where: { id, organizationId: context.organizationId },
            });
            if (!original)
              throw new NotFoundException('Payment account not found');
            if (original.systemKey)
              throw new BadRequestException('System Cash cannot be changed');
            if (original.version !== (dto as UpdatePaymentAccountDto).version)
              throw new ConflictException(
                'Payment account version changed; reload before saving',
              );
          }
          const name = dto.name.trim();
          const normalizedName = name.toLowerCase();
          if (normalizedName === 'cash')
            throw new BadRequestException(
              'Cash is reserved for the system account',
            );
          if (
            (dto.assignmentMode === 'ALL' && dto.branchIds.length) ||
            (dto.assignmentMode === 'SELECTED' && !dto.branchIds.length)
          )
            throw new BadRequestException(
              'ALL requires no branches; SELECTED requires at least one branch',
            );
          const branchIds = [
            ...new Set(dto.branchIds.map((b) => b.toLowerCase())),
          ];
          const count = await tx.branch.count({
            where: {
              organizationId: context.organizationId,
              id: { in: branchIds },
            },
          });
          if (count !== branchIds.length)
            throw new NotFoundException('Branch not found');
          const data = {
            name,
            normalizedName,
            enabled: dto.enabled,
            requiresReference: dto.requiresReference,
            assignmentMode: dto.assignmentMode,
          };
          const account = id
            ? await tx.paymentAccount.update({
                where: {
                  id,
                  organizationId: context.organizationId,
                  version: (dto as UpdatePaymentAccountDto).version,
                },
                data: { ...data, version: { increment: 1 } },
              })
            : await tx.paymentAccount.create({
                data: { ...data, organizationId: context.organizationId },
              });
          await tx.paymentAccountBranch.deleteMany({
            where: {
              organizationId: context.organizationId,
              paymentAccountId: account.id,
            },
          });
          if (branchIds.length)
            await tx.paymentAccountBranch.createMany({
              data: branchIds.map((branchId) => ({
                organizationId: context.organizationId,
                paymentAccountId: account.id,
                branchId,
              })),
            });
          return this.response(
            await tx.paymentAccount.findUniqueOrThrow({
              where: { id: account.id, organizationId: context.organizationId },
              include: { branches: true },
            }),
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        paymentWriteConflict(error) ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025')
      )
        throw new ConflictException(
          'Account name or version changed; reload before saving',
        );
      throw error;
    }
  }
  available(
    context: OrganizationContext,
    branchId: string,
    query: BranchPaymentAccountsQueryDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.current(tx, context, false);
        if (
          !['OWNER', 'MANAGER', 'CASHIER'].includes(current.role) ||
          (query.operation === PaymentAccountOperation.REFUND &&
            current.role === 'CASHIER')
        )
          throw new ForbiddenException(
            'Role cannot select payment accounts for this operation',
          );
        const branch = await tx.branch.findFirst({
          where: { AND: [branchScope(current), { id: branchId }] },
          select: { id: true, organization: { select: { status: true } } },
        });
        if (!branch) throw new NotFoundException('Branch not found');
        if (!query.history && branch.organization.status !== 'ACTIVE')
          return [];
        const applicable: Prisma.PaymentAccountWhereInput = {
          enabled: true,
          OR: [
            { assignmentMode: 'ALL' },
            {
              assignmentMode: 'SELECTED',
              branches: {
                some: { organizationId: context.organizationId, branchId },
              },
            },
          ],
        };
        const history: Prisma.PaymentAccountWhereInput =
          query.operation === PaymentAccountOperation.SALE
            ? {
                sales: {
                  some: {
                    organizationId: context.organizationId,
                    branchId,
                    ...(current.role === 'CASHIER'
                      ? { createdById: current.userId }
                      : {}),
                  },
                },
              }
            : {
                refunds: {
                  some: { organizationId: context.organizationId, branchId },
                },
              };
        const accounts = await tx.paymentAccount.findMany({
          where: {
            organizationId: context.organizationId,
            ...(query.history ? { OR: [applicable, history] } : applicable),
          },
          include: {
            branches: {
              where: { organizationId: context.organizationId, branchId },
            },
          },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        });
        return accounts.map((a) => {
          const { branchIds: _branchIds, ...safe } = this.response(a);
          void _branchIds;
          return {
            ...safe,
            available:
              branch.organization.status === 'ACTIVE' &&
              a.enabled &&
              (a.assignmentMode === 'ALL' || a.branches.length > 0),
          };
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
