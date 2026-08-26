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
  const prisma = {
    $transaction: jest.fn(),
    inventory: { findMany: jest.fn(), count: jest.fn() },
    inventoryMovement: { findFirst: jest.fn(), findMany: jest.fn() },
  };
  let service: InventoryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (
        input: ((client: typeof transaction) => unknown) | Promise<unknown>[],
      ) => (Array.isArray(input) ? Promise.all(input) : input(transaction)),
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

  it('returns a tenant-scoped filtered inventory page', async () => {
    const inventoryView = {
      ...inventory,
      product: {
        id: productId,
        organizationId,
        merchantId,
        name: 'Handwoven pouch',
        sku: 'AMH-01',
        barcode: null,
        sellingPrice: new Prisma.Decimal('450.00'),
        status: ProductStatus.ACTIVE,
        createdAt: timestamp,
        updatedAt: timestamp,
        merchant: { id: merchantId, name: 'Amihan Goods', code: 'AMH' },
      },
      branch: { id: branchId, name: 'Makati Main', code: 'MKT' },
    };
    prisma.inventory.findMany.mockResolvedValue([inventoryView]);
    prisma.inventory.count.mockResolvedValue(1);

    await expect(
      service.findAll(organizationId, {
        branchId,
        merchantId,
        search: 'pouch',
        offset: 0,
        limit: 25,
      }),
    ).resolves.toEqual({
      items: [
        {
          ...inventoryView,
          product: { ...inventoryView.product, sellingPrice: '450.00' },
        },
      ],
      total: 1,
      offset: 0,
      limit: 25,
    });
    expect(prisma.inventory.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
        branchId,
        productId: undefined,
        product: {
          merchantId,
          status: undefined,
          OR: [
            { name: { contains: 'pouch', mode: 'insensitive' } },
            { sku: { contains: 'pouch', mode: 'insensitive' } },
            { barcode: { contains: 'pouch', mode: 'insensitive' } },
          ],
        },
      },
      include: {
        product: {
          include: {
            merchant: { select: { id: true, name: true, code: true } },
          },
        },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: [
        { product: { name: 'asc' } },
        { branch: { name: 'asc' } },
        { productId: 'asc' },
      ],
      skip: 0,
      take: 25,
    });
  });

  it('returns movement history with a next cursor', async () => {
    const secondMovementId = '30fb4b47-283d-4ea1-9122-fb5ab8e809ad';
    const movementView = {
      ...movement,
      product: {
        id: productId,
        name: 'Handwoven pouch',
        sku: 'AMH-01',
        barcode: null,
      },
      branch: { id: branchId, name: 'Makati Main', code: 'MKT' },
      createdBy: { id: userId, email: 'manager@example.com' },
    };
    prisma.inventoryMovement.findMany.mockResolvedValue([
      movementView,
      { ...movementView, id: secondMovementId },
    ]);

    await expect(
      service.findMovements(organizationId, { branchId, limit: 1 }),
    ).resolves.toEqual({ items: [movementView], nextCursor: movement.id });
    expect(prisma.inventoryMovement.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
        branchId,
        productId: undefined,
        type: undefined,
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, barcode: true },
        },
        branch: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, email: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      cursor: undefined,
      skip: undefined,
      take: 2,
    });
  });

  it('rejects a movement cursor from another organization', async () => {
    prisma.inventoryMovement.findFirst.mockResolvedValue(null);

    await expect(
      service.findMovements(organizationId, {
        cursor: movement.id,
        limit: 50,
      }),
    ).rejects.toThrow(new NotFoundException('Movement cursor not found'));
    expect(prisma.inventoryMovement.findMany).not.toHaveBeenCalled();
  });
});
