import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizationRole, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { BranchInventoryService } from './branch-inventory.service';
import { inventoryMovementSelect } from './inventory.types';
import { inventoryScope } from '../authorization/resource-access';

describe('BranchInventoryService', () => {
  const prisma = {
    branch: { findUnique: jest.fn() },
    product: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    merchant: { findUnique: jest.fn() },
    branchInventory: {
      fields: { lowStockThreshold: 'threshold-field' },
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    inventoryMovement: { findMany: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new BranchInventoryService(
    prisma as unknown as PrismaService,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (run: (tx: typeof prisma) => unknown) => run(prisma),
    );
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
    prisma.inventoryMovement.findMany.mockResolvedValue([]);
    prisma.inventoryMovement.findFirst.mockResolvedValue({ id: 'cursor' });
    prisma.branchInventory.findFirst.mockResolvedValue({ id: 'cursor' });
    prisma.product.findFirst.mockResolvedValue({ id: 'cursor' });
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
        id: 'low',
        sellingPrice: new Prisma.Decimal('12.50'),
        quantity: 5,
        lowStockThreshold: 5,
      },
    ]);
    await expect(
      service.findAll('org', 'branch', { stockStatus: 'LOW_STOCK' }),
    ).resolves.toEqual({
      items: [expect.objectContaining({ id: 'low', stockStatus: 'LOW_STOCK' })],
      nextCursor: null,
    });
    expect(prisma.branchInventory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest's nested matcher is intentionally untyped.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          quantity: { gt: 0, lte: 'threshold-field' },
          lowStockThreshold: { gt: 0 },
        }),
      }),
    );
  });

  it('bounds inventory pages and rejects cursors from another filter or role', async () => {
    const firstId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const secondId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const owner = {
      organizationId: 'org',
      userId: 'owner',
      role: OrganizationRole.OWNER,
    };
    const row = (id: string) => ({
      id,
      sellingPrice: new Prisma.Decimal('12.50'),
      quantity: 1,
      lowStockThreshold: 5,
    });
    prisma.branchInventory.findMany.mockResolvedValueOnce([
      row(firstId),
      row(secondId),
    ]);
    const first = await service.findAll(
      'org',
      'branch',
      { limit: 1, q: 'cup' },
      owner,
    );
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toMatch(new RegExp(`^${firstId}\\.[0-9a-f]{64}$`));
    expect(prisma.branchInventory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
        orderBy: [{ product: { name: 'asc' } }, { id: 'asc' }],
      }),
    );
    await expect(
      service.findAll(
        'org',
        'branch',
        {
          limit: 1,
          q: 'plate',
          cursor: first.nextCursor!,
        },
        owner,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.findAll(
        'org',
        'branch',
        {
          limit: 1,
          q: 'cup',
          cursor: first.nextCursor!,
        },
        { ...owner, role: OrganizationRole.MANAGER },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.branchInventory.findFirst).not.toHaveBeenCalled();
    prisma.branchInventory.findMany.mockResolvedValueOnce([row(secondId)]);
    const next = await service.findAll(
      'org',
      'branch',
      {
        limit: 1,
        q: 'cup',
        cursor: first.nextCursor!,
      },
      owner,
    );
    expect(next).toMatchObject({ nextCursor: null, items: [{ id: secondId }] });
    expect(prisma.branchInventory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest's nested matcher is intentionally untyped.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          id: firstId,
          organizationId: 'org',
          branchId: 'branch',
        }),
      }),
    );
    prisma.branchInventory.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.findAll(
        'org',
        'branch',
        {
          limit: 1,
          q: 'cup',
          cursor: first.nextCursor!,
        },
        owner,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns only bounded, active and not-yet-placed picker candidates under manager scope', async () => {
    const manager = {
      organizationId: 'org',
      userId: 'manager',
      role: OrganizationRole.MANAGER,
    };
    const firstId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const secondId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    prisma.product.findMany.mockResolvedValueOnce([
      { id: firstId },
      { id: secondId },
    ]);
    const first = await service.eligibleProducts(
      'org',
      'branch',
      { limit: 1, q: 'cup' },
      manager,
    );
    expect(first.items).toEqual([{ id: firstId }]);
    expect(first.nextCursor).toBeTruthy();
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
        // Jest's nested matcher is intentionally untyped.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          organizationId: 'org',
          status: 'ACTIVE',
          merchant: { organizationId: 'org', status: 'ACTIVE' },
          AND: [
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            expect.objectContaining({ inventory: expect.any(Object) }),
            {
              inventory: {
                none: { organizationId: 'org', branchId: 'branch' },
              },
            },
          ],
        }),
      }),
    );
    await expect(
      service.eligibleProducts(
        'org',
        'branch',
        {
          limit: 1,
          q: 'other',
          cursor: first.nextCursor!,
        },
        manager,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.product.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.eligibleProducts(
        'org',
        'branch',
        {
          limit: 1,
          q: 'cup',
          cursor: first.nextCursor!,
        },
        manager,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('summarizes only role-scoped placements using the shared status rules', async () => {
    prisma.branchInventory.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2);
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
    expect(prisma.branchInventory.count).toHaveBeenCalledTimes(3);
    expect(prisma.branchInventory.count).toHaveBeenNthCalledWith(2, {
      where: {
        organizationId: 'org',
        branchId: 'branch',
        AND: [inventoryScope(context)],
        quantity: { gt: 0, lte: 'threshold-field' },
        lowStockThreshold: { gt: 0 },
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
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
      take: 51,
    });
    prisma.branchInventory.findUnique.mockResolvedValue(null);
    prisma.inventoryMovement.findMany.mockClear();
    await expect(
      service.findMovements('org', 'other', 'inventory'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.inventoryMovement.findMany).not.toHaveBeenCalled();
  });

  it('bounds history and rejects a foreign movement cursor', async () => {
    prisma.inventoryMovement.findMany.mockResolvedValue(
      Array.from({ length: 3 }, (_, index) => ({
        id: `movement-${index}`,
        createdById: 'actor',
      })),
    );
    const page = await service.findMovements(
      'org',
      'branch',
      'inventory',
      undefined,
      { limit: 2 },
    );
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe('movement-1');
    prisma.inventoryMovement.findFirst.mockResolvedValue(null);
    prisma.inventoryMovement.findMany.mockClear();
    await expect(
      service.findMovements('org', 'branch', 'inventory', undefined, {
        limit: 2,
        cursor: 'foreign',
      }),
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
