import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { BranchInventoryService } from './branch-inventory.service';
import { inventoryMovementSelect } from './inventory.types';
import { inventoryScope } from '../authorization/resource-access';

describe('BranchInventoryService', () => {
  const prisma = {
    branch: { findUnique: jest.fn() },
    product: { findUnique: jest.fn() },
    merchant: { findUnique: jest.fn() },
    branchInventory: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    inventoryMovement: { findMany: jest.fn() },
  };
  const service = new BranchInventoryService(
    prisma as unknown as PrismaService,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.branch.findUnique.mockResolvedValue({ id: 'branch' });
    prisma.product.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      merchant: { status: 'ACTIVE' },
    });
    prisma.branchInventory.create.mockResolvedValue({
      sellingPrice: new Prisma.Decimal('12.50'),
      quantity: 0,
      lowStockThreshold: 5,
    });
    prisma.branchInventory.findUnique.mockResolvedValue({
      sellingPrice: new Prisma.Decimal('12.50'),
      quantity: 5,
      lowStockThreshold: 5,
    });
    prisma.branchInventory.update.mockResolvedValue({
      sellingPrice: new Prisma.Decimal('13.75'),
      quantity: 5,
      lowStockThreshold: 5,
    });
  });

  it('creates a zero-stock placement with decimal price and no opening movement', async () => {
    await expect(
      service.create('org', 'branch', {
        productId: 'product',
        sellingPrice: '12.50',
      }),
    ).resolves.toMatchObject({ sellingPrice: '12.50', quantity: 0 });
    expect(prisma.branchInventory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          organizationId: 'org',
          branchId: 'branch',
          productId: 'product',
          sellingPrice: new Prisma.Decimal('12.50'),
          lowStockThreshold: 5,
        },
      }),
    );
  });

  it('stores an explicit per-branch threshold including zero', async () => {
    await service.create('org', 'branch', {
      productId: 'product',
      sellingPrice: '12.50',
      lowStockThreshold: 0,
    });
    expect(prisma.branchInventory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          organizationId: 'org',
          branchId: 'branch',
          productId: 'product',
          sellingPrice: new Prisma.Decimal('12.50'),
          lowStockThreshold: 0,
        },
      }),
    );
  });

  it('rejects foreign branches before resolving products', async () => {
    prisma.branch.findUnique.mockResolvedValue(null);
    await expect(
      service.create('org', 'foreign', {
        productId: 'product',
        sellingPrice: '1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.branch.findUnique).toHaveBeenCalledWith({
      where: { id: 'foreign', organizationId: 'org' },
      select: { id: true },
    });
    expect(prisma.product.findUnique).not.toHaveBeenCalled();
  });

  it('rejects absent/foreign products without writing inventory', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(
      service.create('org', 'branch', {
        productId: 'foreign',
        sellingPrice: '1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.branchInventory.create).not.toHaveBeenCalled();
  });

  it.each(['product', 'merchant'])(
    'rejects inactive %s placements',
    async (target) => {
      prisma.product.findUnique.mockResolvedValue({
        status: target === 'product' ? 'INACTIVE' : 'ACTIVE',
        merchant: { status: target === 'merchant' ? 'SUSPENDED' : 'ACTIVE' },
      });
      await expect(
        service.create('org', 'branch', {
          productId: 'product',
          sellingPrice: '1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.branchInventory.create).not.toHaveBeenCalled();
    },
  );

  it('price edits write only a precise price under branch and tenant scope', async () => {
    await expect(
      service.updatePrice('org', 'branch', 'inventory', {
        sellingPrice: '13.75',
      }),
    ).resolves.toMatchObject({ quantity: 5, sellingPrice: '13.75' });
    expect(prisma.branchInventory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inventory', organizationId: 'org', branchId: 'branch' },
        data: { sellingPrice: new Prisma.Decimal('13.75') },
      }),
    );
  });

  it('threshold edits write only the threshold under branch and tenant scope', async () => {
    prisma.branchInventory.update.mockResolvedValue({
      sellingPrice: new Prisma.Decimal('12.50'),
      quantity: 5,
      lowStockThreshold: 0,
    });
    await expect(
      service.updateThreshold('org', 'branch', 'inventory', {
        lowStockThreshold: 0,
      }),
    ).resolves.toMatchObject({
      quantity: 5,
      lowStockThreshold: 0,
      stockStatus: 'IN_STOCK',
    });
    expect(prisma.branchInventory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inventory', organizationId: 'org', branchId: 'branch' },
        data: { lowStockThreshold: 0 },
      }),
    );
  });

  it.each([
    [0, 0, 'OUT_OF_STOCK'],
    [0, 5, 'OUT_OF_STOCK'],
    [1, 5, 'LOW_STOCK'],
    [5, 5, 'LOW_STOCK'],
    [6, 5, 'IN_STOCK'],
    [1, 0, 'IN_STOCK'],
  ] as const)(
    'derives quantity %s and threshold %s as %s',
    async (quantity, lowStockThreshold, stockStatus) => {
      prisma.branchInventory.findUnique.mockResolvedValue({
        sellingPrice: new Prisma.Decimal('12.50'),
        quantity,
        lowStockThreshold,
      });
      await expect(
        service.findOne('org', 'branch', 'inventory'),
      ).resolves.toMatchObject({ stockStatus });
    },
  );

  it('filters using the same derived stock status returned by the API', async () => {
    prisma.branchInventory.findMany.mockResolvedValue([
      {
        id: 'empty',
        sellingPrice: new Prisma.Decimal('12.50'),
        quantity: 0,
        lowStockThreshold: 5,
      },
      {
        id: 'low',
        sellingPrice: new Prisma.Decimal('12.50'),
        quantity: 5,
        lowStockThreshold: 5,
      },
      {
        id: 'healthy',
        sellingPrice: new Prisma.Decimal('12.50'),
        quantity: 6,
        lowStockThreshold: 5,
      },
    ]);
    await expect(
      service.findAll('org', 'branch', { stockStatus: 'LOW_STOCK' }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'low', stockStatus: 'LOW_STOCK' }),
    ]);
  });

  it('summarizes only role-scoped placements using the shared status rules', async () => {
    prisma.branchInventory.findMany.mockResolvedValue([
      { quantity: 0, lowStockThreshold: 0 },
      { quantity: 1, lowStockThreshold: 5 },
      { quantity: 5, lowStockThreshold: 5 },
      { quantity: 6, lowStockThreshold: 5 },
      { quantity: 1, lowStockThreshold: 0 },
    ]);
    const context = {
      organizationId: 'org',
      userId: 'merchant-user',
      role: 'MERCHANT',
      merchantId: 'merchant',
      branchIds: ['branch'],
    } as const;
    await expect(service.summarize('org', 'branch', context)).resolves.toEqual({
      inStock: 2,
      lowStock: 2,
      outOfStock: 1,
    });
    expect(prisma.branchInventory.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org',
        branchId: 'branch',
        AND: [inventoryScope(context)],
      },
      select: { quantity: true, lowStockThreshold: true },
    });
  });

  it('history queries enforce placement access and stable scoped ordering', async () => {
    await service.findMovements('org', 'branch', 'inventory');
    expect(prisma.inventoryMovement.findMany).toHaveBeenCalledWith({
      select: inventoryMovementSelect,
      where: {
        organizationId: 'org',
        branchId: 'branch',
        branchInventoryId: 'inventory',
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    prisma.branchInventory.findUnique.mockResolvedValue(null);
    prisma.inventoryMovement.findMany.mockClear();
    await expect(
      service.findMovements('org', 'other', 'inventory'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.inventoryMovement.findMany).not.toHaveBeenCalled();
  });

  it('rejects foreign merchant filters before running inventory directory queries', async () => {
    prisma.merchant.findUnique.mockResolvedValue(null);
    await expect(
      service.findAll('org', 'branch', { merchantId: 'foreign' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.branchInventory.findMany).not.toHaveBeenCalled();
  });
});
