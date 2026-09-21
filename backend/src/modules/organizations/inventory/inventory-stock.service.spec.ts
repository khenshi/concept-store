import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { InventoryStockService } from './inventory-stock.service';
import { inventoryMovementSelect } from './inventory.types';

describe('InventoryStockService', () => {
  const dto = { quantity: 3, requestId: 'request' };
  const movement = {
    id: 'movement',
    organizationId: 'org',
    branchId: 'branch',
    branchInventoryId: 'inventory',
    type: 'RECEIPT',
    quantityChange: 3,
    quantityAfter: 8,
    reason: 'Stock received',
    createdById: 'actor',
    requestId: 'request',
  };
  const tx = {
    branchInventory: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    inventoryMovement: { findUnique: jest.fn(), create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    inventoryMovement: { findUnique: jest.fn() },
  };
  const service = new InventoryStockService(prisma as unknown as PrismaService);
  const receive = () =>
    service.receive('org', 'branch', 'inventory', 'actor', dto);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    tx.branchInventory.findUnique.mockResolvedValue({
      id: 'inventory',
      product: { status: 'ACTIVE', merchant: { status: 'ACTIVE' } },
    });
    tx.inventoryMovement.findUnique.mockResolvedValue(null);
    prisma.inventoryMovement.findUnique.mockResolvedValue(null);
    tx.branchInventory.updateMany.mockResolvedValue({ count: 1 });
    tx.branchInventory.findUniqueOrThrow.mockResolvedValue({ quantity: 8 });
    tx.inventoryMovement.create.mockResolvedValue(movement);
  });

  it('uses a bounded tenant/branch atomic increment and trusted actor in one transaction', async () => {
    await expect(receive()).resolves.toEqual(movement);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'ReadCommitted',
    });
    expect(tx.branchInventory.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'inventory',
        organizationId: 'org',
        branchId: 'branch',
        quantity: { gte: 0, lte: 2147483644 },
      },
      data: { quantity: { increment: 3 } },
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      select: inventoryMovementSelect,
      data: {
        organizationId: 'org',
        branchId: 'branch',
        branchInventoryId: 'inventory',
        type: 'RECEIPT',
        quantityChange: 3,
        quantityAfter: 8,
        reason: 'Stock received',
        createdById: 'actor',
        requestId: 'request',
      },
    });
  });

  it('returns not found before exposing commands for absent or foreign inventory', async () => {
    tx.branchInventory.findUnique.mockResolvedValue(null);
    await expect(receive()).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.branchInventory.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inventory', organizationId: 'org', branchId: 'branch' },
      }),
    );
    expect(tx.inventoryMovement.findUnique).not.toHaveBeenCalled();
    expect(tx.branchInventory.updateMany).not.toHaveBeenCalled();
  });

  it.each(['product', 'merchant'])(
    'rejects new receipts when %s is inactive',
    async (target) => {
      tx.branchInventory.findUnique.mockResolvedValue({
        id: 'inventory',
        product: {
          status: target === 'product' ? 'INACTIVE' : 'ACTIVE',
          merchant: { status: target === 'merchant' ? 'INACTIVE' : 'ACTIVE' },
        },
      });
      await expect(receive()).rejects.toBeInstanceOf(ConflictException);
      expect(tx.branchInventory.updateMany).not.toHaveBeenCalled();
    },
  );

  it('allows corrective adjustments on inactive products and protects lower bound', async () => {
    tx.branchInventory.findUnique.mockResolvedValue({
      id: 'inventory',
      product: { status: 'INACTIVE', merchant: { status: 'INACTIVE' } },
    });
    await service.adjust('org', 'branch', 'inventory', 'actor', {
      quantityChange: -3,
      reason: 'Correction',
      requestId: 'adjustment',
    });
    expect(tx.branchInventory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'inventory',
          organizationId: 'org',
          branchId: 'branch',
          quantity: { gte: 3, lte: 2147483647 },
        },
        data: { quantity: { increment: -3 } },
      }),
    );
  });

  it('rejects impossible minimum-integer adjustments before issuing SQL', async () => {
    await expect(
      service.adjust('org', 'branch', 'inventory', 'actor', {
        quantityChange: -2147483648,
        reason: 'Correction',
        requestId: 'adjustment',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.branchInventory.updateMany).not.toHaveBeenCalled();
  });

  it('does not insert movement after a range conflict', async () => {
    tx.branchInventory.updateMany.mockResolvedValue({ count: 0 });
    await expect(receive()).rejects.toBeInstanceOf(ConflictException);
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('replays original snapshot without modifying stock even after deactivation', async () => {
    tx.branchInventory.findUnique.mockResolvedValue({
      id: 'inventory',
      product: { status: 'INACTIVE', merchant: { status: 'INACTIVE' } },
    });
    tx.inventoryMovement.findUnique.mockResolvedValue(movement);
    await expect(receive()).resolves.toEqual(movement);
    expect(tx.branchInventory.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    { quantityChange: 4 },
    { branchId: 'other' },
    { branchInventoryId: 'other' },
    { type: 'ADJUSTMENT' },
  ])('rejects conflicting request reuse %j', async (extra) => {
    tx.inventoryMovement.findUnique.mockResolvedValue({
      ...movement,
      ...extra,
    });
    await expect(receive()).rejects.toBeInstanceOf(ConflictException);
    expect(tx.branchInventory.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    new ConflictException('range'),
    new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    }),
  ])(
    'resolves a concurrently committed original after transaction rejection',
    async (error) => {
      prisma.$transaction.mockRejectedValue(error);
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement);
      await expect(receive()).resolves.toEqual(movement);
      expect(prisma.inventoryMovement.findUnique).toHaveBeenCalledWith({
        select: inventoryMovementSelect,
        where: {
          organizationId_requestId: {
            organizationId: 'org',
            requestId: 'request',
          },
        },
      });
    },
  );

  it('propagates movement insertion failure out of the transaction', async () => {
    const error = new Error('write failed');
    tx.inventoryMovement.create.mockRejectedValue(error);
    await expect(receive()).rejects.toBe(error);
    expect(prisma.inventoryMovement.findUnique).not.toHaveBeenCalled();
    // Actual rollback is a PostgreSQL integration assertion, not established by this mock.
  });
});
