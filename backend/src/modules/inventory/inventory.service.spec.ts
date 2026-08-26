import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  InventoryMovementType,
  Prisma,
  ProductStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  const organizationId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const userId = '160872ff-c20b-4cee-a58c-06a5d4431509';
  const merchantId = '2f671678-91d3-4d04-a8f9-787a2e9f3c1a';
  const productId = '84f45f0b-b07b-430d-9a62-5c96030c762a';
  const branchId = '6b109a2f-142c-4af4-93d8-12941d0685ac';
  const timestamp = new Date('2026-08-26T00:00:00.000Z');
  const inventory = {
    organizationId,
    branchId,
    productId,
    quantity: 12,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const movement = {
    id: '0e488580-60b9-4f83-b6c2-b27424681060',
    organizationId,
    branchId,
    productId,
    quantityChange: 12,
    type: InventoryMovementType.STOCK_IN,
    referenceId: 'DELIVERY-1',
    note: 'Received from merchant',
    createdById: userId,
    createdAt: timestamp,
  };
  const transaction = {
    product: { findFirst: jest.fn() },
    branch: { findFirst: jest.fn() },
    merchantBranch: { findFirst: jest.fn() },
    inventory: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventoryMovement: { create: jest.fn() },
  };
  const prisma = { $transaction: jest.fn() };
  let service: InventoryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
    );
    transaction.product.findFirst.mockResolvedValue({
      merchantId,
      status: ProductStatus.ACTIVE,
    });
    transaction.branch.findFirst.mockResolvedValue({ id: branchId });
    transaction.merchantBranch.findFirst.mockResolvedValue({ merchantId });
    const moduleRef = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(InventoryService);
  });

  it('creates inventory and a stock-in movement atomically', async () => {
    transaction.inventory.findUnique.mockResolvedValue(null);
    transaction.inventory.create.mockResolvedValue(inventory);
    transaction.inventoryMovement.create.mockResolvedValue(movement);

    await expect(
      service.stockIn(organizationId, userId, {
        productId,
        branchId,
        quantity: 12,
        referenceId: 'DELIVERY-1',
        note: 'Received from merchant',
      }),
    ).resolves.toEqual({ inventory, movement });
    expect(transaction.inventory.create).toHaveBeenCalledWith({
      data: { organizationId, branchId, productId, quantity: 12 },
    });
    expect(transaction.inventoryMovement.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        branchId,
        productId,
        quantityChange: 12,
        type: InventoryMovementType.STOCK_IN,
        note: 'Received from merchant',
        referenceId: 'DELIVERY-1',
        createdById: userId,
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('increments existing inventory during stock-in', async () => {
    transaction.inventory.findUnique.mockResolvedValue({ productId });
    transaction.inventory.update.mockResolvedValue({
      ...inventory,
      quantity: 20,
    });
    transaction.inventoryMovement.create.mockResolvedValue({
      ...movement,
      quantityChange: 8,
    });

    await service.stockIn(organizationId, userId, {
      productId,
      branchId,
      quantity: 8,
    });
    expect(transaction.inventory.update).toHaveBeenCalledWith({
      where: {
        productId_branchId_organizationId: {
          productId,
          branchId,
          organizationId,
        },
      },
      data: { quantity: { increment: 8 } },
    });
  });

  it('applies a signed adjustment and records the explanation', async () => {
    transaction.inventory.findUnique.mockResolvedValue({ productId });
    transaction.inventory.update.mockResolvedValue({
      ...inventory,
      quantity: -2,
    });
    const adjustment = {
      ...movement,
      quantityChange: -14,
      type: InventoryMovementType.ADJUSTMENT,
      note: 'Physical count correction',
      referenceId: null,
    };
    transaction.inventoryMovement.create.mockResolvedValue(adjustment);

    await expect(
      service.adjust(organizationId, userId, {
        productId,
        branchId,
        quantityChange: -14,
        note: 'Physical count correction',
      }),
    ).resolves.toMatchObject({
      inventory: { quantity: -2 },
      movement: adjustment,
    });
    expect(transaction.inventory.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { quantity: { increment: -14 } } }),
    );
  });

  it('requires an existing inventory row for adjustments', async () => {
    transaction.inventory.findUnique.mockResolvedValue(null);

    await expect(
      service.adjust(organizationId, userId, {
        productId,
        branchId,
        quantityChange: 1,
        note: 'Count correction',
      }),
    ).rejects.toThrow(new NotFoundException('Inventory record not found'));
    expect(transaction.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('does not reveal a product outside the organization', async () => {
    transaction.product.findFirst.mockResolvedValue(null);

    await expect(
      service.stockIn(organizationId, userId, {
        productId,
        branchId,
        quantity: 1,
      }),
    ).rejects.toThrow(new NotFoundException('Product not found'));
    expect(transaction.branch.findFirst).not.toHaveBeenCalled();
  });

  it('blocks stock-in when the merchant does not operate at the branch', async () => {
    transaction.merchantBranch.findFirst.mockResolvedValue(null);

    await expect(
      service.stockIn(organizationId, userId, {
        productId,
        branchId,
        quantity: 1,
      }),
    ).rejects.toThrow(
      new ConflictException('Product merchant does not operate in this branch'),
    );
    expect(transaction.inventory.findUnique).not.toHaveBeenCalled();
  });

  it('blocks stock-in for an inactive product', async () => {
    transaction.product.findFirst.mockResolvedValue({
      merchantId,
      status: ProductStatus.INACTIVE,
    });

    await expect(
      service.stockIn(organizationId, userId, {
        productId,
        branchId,
        quantity: 1,
      }),
    ).rejects.toThrow(
      new ConflictException('Inactive products cannot receive inventory'),
    );
  });

  it('maps serialization conflicts to a retryable conflict response', async () => {
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Write conflict', {
        code: 'P2034',
        clientVersion: '7.9.1',
      }),
    );

    await expect(
      service.stockIn(organizationId, userId, {
        productId,
        branchId,
        quantity: 1,
      }),
    ).rejects.toThrow(
      new ConflictException(
        'Inventory changed concurrently; retry the request',
      ),
    );
  });
});
