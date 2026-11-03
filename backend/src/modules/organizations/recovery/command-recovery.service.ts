import { plainToInstance } from 'class-transformer';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { validateSync } from 'class-validator';
import { isDeepStrictEqual } from 'node:util';
import { Prisma } from '../../../generated/prisma/client';
import {
  CommandRecoveryKind,
  CommandRecoveryState,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { branchScope } from '../authorization/resource-access';
import { CheckoutService } from '../sales/checkout.service';
import { CheckoutDto } from '../sales/dto/checkout.dto';
import { CreateRefundDto } from '../refunds/dto/create-refund.dto';
import { RefundsService } from '../refunds/refunds.service';
import {
  completedSaleResponse,
  completedSaleSelect,
} from '../sales/sales.types';
import {
  completedRefundResponse,
  completedRefundSelect,
} from '../refunds/refunds.types';
import {
  CommandRecoveryResponseDto,
  PrepareCommandRecoveryDto,
} from './dto/command-recovery.dto';

const blockingStates = [
  CommandRecoveryState.PREPARED,
  CommandRecoveryState.SUBMITTED,
  CommandRecoveryState.COMPLETED,
] as const;
const exactDecimal = Prisma.Decimal.clone({ precision: 40 });

type RecoveryCommand = CheckoutDto | CreateRefundDto;
type CanonicalCommand = Prisma.InputJsonObject & { requestId: string };
type RecoveryRecord = Prisma.CommandRecoveryGetPayload<{
  select: typeof recoverySelect;
}>;

const recoverySelect = {
  id: true,
  organizationId: true,
  actorUserId: true,
  kind: true,
  state: true,
  requestId: true,
  branchId: true,
  saleId: true,
  commandVersion: true,
  command: true,
  sourceId: true,
  createdAt: true,
  submittedAt: true,
  completedAt: true,
  acknowledgedAt: true,
  closedAt: true,
} satisfies Prisma.CommandRecoverySelect;

@Injectable()
export class CommandRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkout: CheckoutService,
    private readonly refunds: RefundsService,
  ) {}

  async prepare(
    context: OrganizationContext,
    input: PrepareCommandRecoveryDto,
  ): Promise<CommandRecoveryResponseDto> {
    const normalized = this.normalizeCommand(input.kind, input.command);
    const { requestId, ...command } = normalized;
    const saleId =
      input.kind === CommandRecoveryKind.REFUND ? (input.saleId ?? null) : null;
    if (input.kind === CommandRecoveryKind.REFUND && !saleId)
      throw new BadRequestException('Refund recovery requires a sale ID');

    try {
      const record = await this.prisma.$transaction(
        async (tx) => {
          await this.authorizeScope(
            tx,
            context,
            input.kind,
            input.branchId,
            saleId,
          );
          const existing = await tx.commandRecovery.findUnique({
            where: {
              organizationId_kind_requestId: {
                organizationId: context.organizationId,
                kind: input.kind,
                requestId,
              },
            },
            select: recoverySelect,
          });
          if (existing) {
            this.assertSameCommand(existing, input.branchId, saleId, command);
            return existing;
          }

          const blocking = await tx.commandRecovery.findFirst({
            where: {
              organizationId: context.organizationId,
              actorUserId: context.userId,
              kind: input.kind,
              state: { in: [...blockingStates] },
            },
            orderBy: { createdAt: 'desc' },
            select: recoverySelect,
          });
          if (blocking) {
            throw new ConflictException({
              message:
                'Resolve the existing recovery before starting another command',
              code: 'COMMAND_RECOVERY_BLOCKED',
              recoveryId: blocking.id,
              kind: blocking.kind,
            });
          }

          const source = await this.findSource(
            tx,
            input.kind,
            context.organizationId,
            requestId,
          );
          if (source) {
            this.assertSourceOwner(
              source,
              context.userId,
              input.branchId,
              saleId,
              command,
            );
            return tx.commandRecovery.create({
              data: {
                organizationId: context.organizationId,
                actorUserId: context.userId,
                kind: input.kind,
                state: CommandRecoveryState.COMPLETED,
                requestId,
                branchId: input.branchId,
                saleId,
                commandVersion: 1,
                command,
                sourceId: source.id,
                submittedAt: source.completedAt,
                completedAt: source.completedAt,
              },
              select: recoverySelect,
            });
          }

          return tx.commandRecovery.create({
            data: {
              organizationId: context.organizationId,
              actorUserId: context.userId,
              kind: input.kind,
              requestId,
              branchId: input.branchId,
              saleId,
              commandVersion: 1,
              command,
            },
            select: recoverySelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.view(context, record);
    } catch (error: unknown) {
      if (!this.isUniqueConflict(error)) throw error;
      const current = await this.prisma.commandRecovery.findFirst({
        where: {
          organizationId: context.organizationId,
          actorUserId: context.userId,
          kind: input.kind,
          state: { in: [...blockingStates] },
        },
        orderBy: { createdAt: 'desc' },
        select: recoverySelect,
      });
      if (current) {
        this.assertSameCommand(current, input.branchId, saleId, command);
        return this.view(context, current);
      }
      const conflictingRequest = await this.prisma.commandRecovery.findUnique({
        where: {
          organizationId_kind_requestId: {
            organizationId: context.organizationId,
            kind: input.kind,
            requestId,
          },
        },
        select: { id: true },
      });
      if (conflictingRequest)
        throw new ConflictException({
          message: 'Recovery ID was already used for another command',
          code: 'REQUEST_ID_CONFLICT',
        });
      throw error;
    }
  }

  async list(
    context: OrganizationContext,
    kind?: CommandRecoveryKind,
  ): Promise<CommandRecoveryResponseDto[]> {
    const records = await this.prisma.commandRecovery.findMany({
      where: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        ...(kind ? { kind } : {}),
        state: { in: [...blockingStates] },
        branch: { is: branchScope(context) },
      },
      orderBy: { createdAt: 'desc' },
      select: recoverySelect,
    });
    return Promise.all(records.map((record) => this.view(context, record)));
  }

  async get(context: OrganizationContext, id: string) {
    const record = await this.load(context, id);
    return this.view(context, record);
  }

  async submit(context: OrganizationContext, id: string) {
    let record = await this.load(context, id);
    if (
      record.state === CommandRecoveryState.ACKNOWLEDGED ||
      record.state === CommandRecoveryState.ABANDONED
    )
      throw new ConflictException('This recovery command is already closed');
    if (record.state === CommandRecoveryState.COMPLETED)
      return this.view(context, record);

    if (record.state === CommandRecoveryState.PREPARED) {
      await this.prisma.commandRecovery.updateMany({
        where: {
          id,
          organizationId: context.organizationId,
          actorUserId: context.userId,
          state: CommandRecoveryState.PREPARED,
        },
        data: {
          state: CommandRecoveryState.SUBMITTED,
          submittedAt: new Date(),
        },
      });
      record = await this.load(context, id);
      if (record.state === CommandRecoveryState.ABANDONED)
        throw new ConflictException('This recovery command was abandoned');
      if (record.state === CommandRecoveryState.COMPLETED)
        return this.view(context, record);
    }

    const source = await this.findSource(
      this.prisma,
      record.kind,
      context.organizationId,
      record.requestId,
    );
    if (source) {
      this.assertSourceOwner(
        source,
        context.userId,
        record.branchId,
        record.saleId,
        record.command,
      );
      record = await this.completeRecord(record, source.id, source.completedAt);
      return this.view(context, record);
    }

    try {
      const result =
        record.kind === CommandRecoveryKind.CHECKOUT
          ? await this.checkout.complete(
              context,
              record.branchId,
              this.checkoutCommand(record.command, record.requestId),
            )
          : await this.refunds.complete(
              context,
              record.branchId,
              record.saleId!,
              this.refundCommand(record.command, record.requestId),
            );
      record = await this.completeRecord(record, result.id, result.completedAt);
      return this.view(
        context,
        record,
        result as unknown as Record<string, unknown>,
      );
    } catch (error: unknown) {
      const outcome = await this.findSource(
        this.prisma,
        record.kind,
        context.organizationId,
        record.requestId,
      );
      if (outcome) {
        this.assertSourceOwner(
          outcome,
          context.userId,
          record.branchId,
          record.saleId,
          record.command,
        );
        record = await this.completeRecord(
          record,
          outcome.id,
          outcome.completedAt,
        );
        return this.view(context, record);
      }
      if (this.isSafeRejection(error)) {
        await this.prisma.commandRecovery.updateMany({
          where: {
            id: record.id,
            organizationId: context.organizationId,
            actorUserId: context.userId,
            state: CommandRecoveryState.SUBMITTED,
          },
          data: { state: CommandRecoveryState.PREPARED, submittedAt: null },
        });
      }
      throw error;
    }
  }

  async acknowledge(context: OrganizationContext, id: string) {
    let record = await this.load(context, id);
    if (record.state === CommandRecoveryState.ACKNOWLEDGED)
      return this.view(context, record);
    if (record.state !== CommandRecoveryState.COMPLETED) {
      const source = await this.findSource(
        this.prisma,
        record.kind,
        context.organizationId,
        record.requestId,
      );
      if (!source)
        throw new ConflictException({
          message: 'The command outcome is not confirmed',
          code: 'COMMAND_RECOVERY_UNKNOWN',
        });
      this.assertSourceOwner(
        source,
        context.userId,
        record.branchId,
        record.saleId,
        record.command,
      );
      record = await this.completeRecord(record, source.id, source.completedAt);
    }
    const acknowledged = await this.prisma.commandRecovery.update({
      where: { id: record.id },
      data: {
        state: CommandRecoveryState.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
      },
      select: recoverySelect,
    });
    return this.view(context, acknowledged);
  }

  async abandon(context: OrganizationContext, id: string) {
    const record = await this.load(context, id);
    if (record.state !== CommandRecoveryState.PREPARED)
      throw new ConflictException('Only a prepared command can be abandoned');
    const source = await this.findSource(
      this.prisma,
      record.kind,
      context.organizationId,
      record.requestId,
    );
    if (source)
      throw new ConflictException({
        message: 'This command already has a saved outcome',
        code: 'COMMAND_RECOVERY_COMPLETED',
      });
    const abandoned = await this.prisma.commandRecovery.updateMany({
      where: {
        id: record.id,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        state: CommandRecoveryState.PREPARED,
      },
      data: { state: CommandRecoveryState.ABANDONED, closedAt: new Date() },
    });
    if (abandoned.count !== 1)
      throw new ConflictException(
        'The command changed while it was being closed',
      );
    return this.get(context, id);
  }

  async submitLegacy(
    context: OrganizationContext,
    kind: CommandRecoveryKind,
    branchId: string,
    command: RecoveryCommand,
    saleId?: string,
  ) {
    const prepared = await this.prepare(context, {
      kind,
      branchId,
      saleId,
      command: command as unknown as Record<string, unknown>,
    });
    const response = await this.submit(context, prepared.id);
    if (!response.result)
      throw new ConflictException({
        message: 'The command outcome is not confirmed',
        code: 'COMMAND_RECOVERY_UNKNOWN',
      });
    return response.result;
  }

  private async load(context: OrganizationContext, id: string) {
    const record = await this.prisma.commandRecovery.findFirst({
      where: {
        id,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        branch: { is: branchScope(context) },
      },
      select: recoverySelect,
    });
    if (!record) throw new NotFoundException('Recovery command not found');
    return record;
  }

  private async authorizeScope(
    tx: Prisma.TransactionClient,
    context: OrganizationContext,
    kind: CommandRecoveryKind,
    branchId: string,
    saleId: string | null,
  ) {
    const membership = await tx.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        user: { deletedAt: null, emailVerifiedAt: { not: null } },
      },
      select: { role: true, merchantId: true },
    });
    if (!membership) throw new NotFoundException('Organization not found');
    if (
      (kind === CommandRecoveryKind.REFUND &&
        !['OWNER', 'MANAGER'].includes(membership.role)) ||
      (kind === CommandRecoveryKind.CHECKOUT &&
        !['OWNER', 'MANAGER', 'CASHIER'].includes(membership.role))
    )
      throw new ForbiddenException(
        'Your organization role cannot recover this command',
      );
    const effective = {
      ...context,
      role: membership.role,
      merchantId: membership.merchantId,
    };
    const branch = await tx.branch.findFirst({
      where: { AND: [branchScope(effective), { id: branchId }] },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (kind === CommandRecoveryKind.REFUND) {
      const sale = await tx.sale.findFirst({
        where: {
          id: saleId!,
          organizationId: context.organizationId,
          branchId,
        },
        select: { id: true },
      });
      if (!sale) throw new NotFoundException('Sale not found');
    }
    return effective;
  }

  private normalizeCommand(
    kind: CommandRecoveryKind,
    raw: unknown,
  ): CanonicalCommand {
    if (kind === CommandRecoveryKind.CHECKOUT) {
      const checkout = plainToInstance(CheckoutDto, raw);
      this.assertValidCommand(checkout);
      return {
        requestId: checkout.requestId,
        items: [...checkout.items]
          .sort((a, b) =>
            a.branchInventoryId.localeCompare(b.branchInventoryId),
          )
          .map((item) => ({
            branchInventoryId: item.branchInventoryId,
            quantity: item.quantity,
            expectedUnitPrice: new exactDecimal(item.expectedUnitPrice).toFixed(
              2,
            ),
          })),
        paymentAccountId: checkout.paymentAccountId,
        ...(checkout.cashTender !== undefined
          ? { cashTender: new exactDecimal(checkout.cashTender).toFixed(2) }
          : {}),
        ...(checkout.paymentReference !== undefined
          ? { paymentReference: checkout.paymentReference }
          : {}),
      };
    }
    const refund = plainToInstance(CreateRefundDto, raw);
    this.assertValidCommand(refund);
    return {
      requestId: refund.requestId,
      items: [...refund.items]
        .sort((a, b) => a.saleItemId.localeCompare(b.saleItemId))
        .map((item) => ({
          saleItemId: item.saleItemId,
          quantity: item.quantity,
          restockQuantity: item.restockQuantity ?? 0,
        })),
      reason: refund.reason.trim(),
      paymentAccountId: refund.paymentAccountId,
      ...(refund.paymentReference !== undefined
        ? { paymentReference: refund.paymentReference.trim() }
        : {}),
      refundConfirmed: true,
    };
  }

  private assertValidCommand(command: object) {
    if (
      validateSync(command, {
        whitelist: true,
        forbidNonWhitelisted: true,
      }).length
    )
      throw new BadRequestException({
        message: 'Invalid recovery command',
        code: 'INVALID_RECOVERY_COMMAND',
      });
  }

  private checkoutCommand(command: Prisma.JsonValue, requestId: string) {
    return { ...(command as object), requestId } as CheckoutDto;
  }

  private refundCommand(command: Prisma.JsonValue, requestId: string) {
    return { ...(command as object), requestId } as CreateRefundDto;
  }

  private async completeRecord(
    record: RecoveryRecord,
    sourceId: string,
    completedAt: Date,
  ) {
    return this.prisma.commandRecovery.update({
      where: { id: record.id },
      data: {
        state: CommandRecoveryState.COMPLETED,
        sourceId,
        submittedAt: record.submittedAt ?? completedAt,
        completedAt,
      },
      select: recoverySelect,
    });
  }

  private async view(
    context: OrganizationContext,
    record: RecoveryRecord,
    result?: Record<string, unknown>,
  ): Promise<CommandRecoveryResponseDto> {
    let current = record;
    let resolved = result ?? null;
    if (
      !resolved &&
      (record.state === CommandRecoveryState.SUBMITTED ||
        record.state === CommandRecoveryState.COMPLETED)
    ) {
      const source = await this.findSource(
        this.prisma,
        record.kind,
        context.organizationId,
        record.requestId,
      );
      if (source) {
        this.assertSourceOwner(
          source,
          context.userId,
          record.branchId,
          record.saleId,
          record.command,
        );
        if (record.state === CommandRecoveryState.SUBMITTED) {
          current = await this.completeRecord(
            record,
            source.id,
            source.completedAt,
          );
        }
        resolved = source.result as unknown as Record<string, unknown>;
      }
    }
    return {
      id: current.id,
      kind: current.kind,
      state: current.state,
      requestId: current.requestId,
      branchId: current.branchId,
      saleId: current.saleId,
      command: current.command as unknown as Record<string, unknown>,
      sourceId: current.sourceId,
      createdAt: current.createdAt,
      submittedAt: current.submittedAt,
      completedAt: current.completedAt,
      acknowledgedAt: current.acknowledgedAt,
      closedAt: current.closedAt,
      result: resolved,
    };
  }

  private async findSource(
    tx: PrismaService | Prisma.TransactionClient,
    kind: CommandRecoveryKind,
    organizationId: string,
    requestId: string,
  ) {
    if (kind === CommandRecoveryKind.CHECKOUT) {
      const sale = await tx.sale.findUnique({
        where: { organizationId_requestId: { organizationId, requestId } },
        select: {
          ...completedSaleSelect,
          createdById: true,
          checkoutCommand: true,
        },
      });
      return sale
        ? {
            id: sale.id,
            branchId: sale.branchId,
            createdById: sale.createdById,
            saleId: null,
            completedAt: sale.completedAt,
            result: completedSaleResponse(sale),
            command: sale.checkoutCommand,
          }
        : null;
    }
    const refund = await tx.refund.findUnique({
      where: { organizationId_requestId: { organizationId, requestId } },
      select: {
        ...completedRefundSelect,
        createdById: true,
        refundCommand: true,
      },
    });
    return refund
      ? {
          id: refund.id,
          branchId: refund.branchId,
          createdById: refund.createdById,
          saleId: refund.saleId,
          completedAt: refund.completedAt,
          result: completedRefundResponse(refund),
          command: refund.refundCommand,
        }
      : null;
  }

  private assertSourceOwner(
    source: {
      createdById: string;
      branchId: string;
      saleId: string | null;
      command: Prisma.JsonValue;
    },
    actorUserId: string,
    branchId: string,
    saleId: string | null,
    command: unknown,
  ) {
    if (
      source.createdById !== actorUserId ||
      source.branchId !== branchId ||
      source.saleId !== saleId ||
      !isDeepStrictEqual(source.command, command)
    )
      throw new ConflictException({
        message: 'The recovery ID is already associated with another command',
        code: 'REQUEST_ID_CONFLICT',
      });
  }

  private assertSameCommand(
    record: RecoveryRecord,
    branchId: string,
    saleId: string | null,
    command: unknown,
  ) {
    if (
      record.branchId !== branchId ||
      record.saleId !== saleId ||
      !isDeepStrictEqual(record.command, command)
    )
      throw new ConflictException({
        message: 'Recovery ID was already used for another command',
        code: 'REQUEST_ID_CONFLICT',
      });
  }

  private isUniqueConflict(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private isSafeRejection(error: unknown) {
    if (
      error instanceof BadRequestException ||
      error instanceof ForbiddenException ||
      error instanceof NotFoundException
    )
      return true;
    if (!(error instanceof ConflictException)) return false;
    const response = error.getResponse();
    const code =
      typeof response === 'object' && response !== null && 'code' in response
        ? response.code
        : undefined;
    return code !== 'CHECKOUT_RETRY' && code !== 'REFUND_RETRY';
  }
}
