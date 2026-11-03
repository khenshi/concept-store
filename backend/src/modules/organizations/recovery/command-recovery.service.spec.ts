import { ConflictException } from '@nestjs/common';
import {
  CommandRecoveryKind,
  CommandRecoveryState,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CheckoutService } from '../sales/checkout.service';
import { RefundsService } from '../refunds/refunds.service';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { CommandRecoveryService } from './command-recovery.service';

describe('CommandRecoveryService', () => {
  const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const actorUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const branchId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const requestId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const inventoryId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const paymentAccountId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const context: OrganizationContext = {
    organizationId,
    userId: actorUserId,
    role: 'OWNER',
  };
  const command = {
    items: [
      {
        branchInventoryId: inventoryId,
        quantity: 1,
        expectedUnitPrice: '850.00',
      },
    ],
    paymentAccountId,
    cashTender: '1000.00',
  };
  const submittedCommand = { ...command, requestId };
  const now = new Date('2026-11-02T00:00:00.000Z');
  const record = (overrides: Record<string, unknown> = {}) => ({
    id: '11111111-1111-4111-8111-111111111111',
    organizationId,
    actorUserId,
    kind: CommandRecoveryKind.CHECKOUT,
    state: CommandRecoveryState.PREPARED,
    requestId,
    branchId,
    saleId: null,
    commandVersion: 1,
    command,
    sourceId: null,
    createdAt: now,
    submittedAt: null,
    completedAt: null,
    acknowledgedAt: null,
    closedAt: null,
    ...overrides,
  });

  const transaction = {
    organizationMembership: { findUnique: jest.fn() },
    branch: { findFirst: jest.fn() },
    sale: { findFirst: jest.fn(), findUnique: jest.fn() },
    commandRecovery: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(),
    commandRecovery: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    sale: { findUnique: jest.fn() },
    refund: { findUnique: jest.fn() },
  };
  const checkout = { complete: jest.fn() };
  const refunds = { complete: jest.fn() };
  let service: CommandRecoveryService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((operation: unknown) =>
      (operation as (client: typeof transaction) => unknown)(transaction),
    );
    transaction.organizationMembership.findUnique.mockResolvedValue({
      role: 'OWNER',
      merchantId: null,
    });
    transaction.branch.findFirst.mockResolvedValue({ id: branchId });
    transaction.sale.findFirst.mockResolvedValue({ id: 'sale-id' });
    transaction.commandRecovery.findUnique.mockResolvedValue(null);
    transaction.commandRecovery.findFirst.mockResolvedValue(null);
    transaction.commandRecovery.create.mockReturnValue(
      Promise.resolve(record()),
    );
    prisma.commandRecovery.findFirst.mockResolvedValue(record());
    prisma.commandRecovery.updateMany.mockResolvedValue({ count: 1 });
    prisma.commandRecovery.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(record(data)),
    );
    prisma.sale.findUnique.mockResolvedValue(null);
    prisma.refund.findUnique.mockResolvedValue(null);
    service = new CommandRecoveryService(
      prisma as unknown as PrismaService,
      checkout as unknown as CheckoutService,
      refunds as unknown as RefundsService,
    );
  });

  it('freezes a normalized command and returns the same envelope for an idempotent prepare', async () => {
    const first = await service.prepare(context, {
      kind: CommandRecoveryKind.CHECKOUT,
      branchId,
      command: {
        ...submittedCommand,
        items: [...command.items].reverse(),
      },
    });
    expect(first.state).toBe(CommandRecoveryState.PREPARED);
    expect(transaction.commandRecovery.create).toHaveBeenCalledTimes(1);
    const createCalls = transaction.commandRecovery.create.mock
      .calls as unknown as Array<[{ data: { command: unknown } }]>;
    const createInput = createCalls[0]?.[0];
    expect(createInput.data.command).toEqual(command);

    transaction.commandRecovery.findUnique.mockResolvedValue(record());
    const second = await service.prepare(context, {
      kind: CommandRecoveryKind.CHECKOUT,
      branchId,
      command: submittedCommand,
    });
    expect(second.id).toBe(first.id);
    expect(transaction.commandRecovery.create).toHaveBeenCalledTimes(1);
  });

  it('blocks a second same-kind command for the actor', async () => {
    transaction.commandRecovery.findFirst.mockResolvedValue(
      record({ state: CommandRecoveryState.SUBMITTED }),
    );

    await expect(
      service.prepare(context, {
        kind: CommandRecoveryKind.CHECKOUT,
        branchId,
        command: submittedCommand,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects reuse of a recovery ID for changed command content', async () => {
    transaction.commandRecovery.findUnique.mockResolvedValue(record());

    await expect(
      service.prepare(context, {
        kind: CommandRecoveryKind.CHECKOUT,
        branchId,
        command: { ...submittedCommand, cashTender: '1100.00' },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('submits once and returns the saved result through the recovery envelope', async () => {
    const saved = record({
      state: CommandRecoveryState.SUBMITTED,
      submittedAt: now,
    });
    prisma.commandRecovery.findFirst
      .mockResolvedValueOnce(record())
      .mockResolvedValueOnce(saved);
    prisma.commandRecovery.update.mockResolvedValue(
      record({
        state: CommandRecoveryState.COMPLETED,
        submittedAt: now,
        completedAt: now,
        sourceId: 'sale-id',
      }),
    );
    checkout.complete.mockResolvedValue({
      id: 'sale-id',
      completedAt: now,
      receiptCode: 'SALE-001',
    });

    const result = await service.submit(context, record().id);

    expect(checkout.complete).toHaveBeenCalledWith(
      context,
      branchId,
      submittedCommand,
    );
    expect(result.state).toBe(CommandRecoveryState.COMPLETED);
    expect(result.result).toEqual({
      id: 'sale-id',
      completedAt: now,
      receiptCode: 'SALE-001',
    });
  });

  it('abandons only a prepared command and closes its blocker', async () => {
    const prepared = record();
    prisma.commandRecovery.findFirst.mockResolvedValue(prepared);
    prisma.commandRecovery.updateMany.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(prepared, data);
        return Promise.resolve({ count: 1 });
      },
    );

    const result = await service.abandon(context, prepared.id);

    expect(result.state).toBe(CommandRecoveryState.ABANDONED);
    expect(result.closedAt).toEqual(expect.any(Date));
    const updateCalls = prisma.commandRecovery.updateMany.mock
      .calls as unknown as Array<[{ where: { state: CommandRecoveryState } }]>;
    const updateInput = updateCalls[0]?.[0];
    expect(updateInput.where.state).toBe(CommandRecoveryState.PREPARED);
  });
});
