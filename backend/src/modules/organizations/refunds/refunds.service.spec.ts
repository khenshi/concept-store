import { Prisma } from '../../../generated/prisma/client';
import { RefundsService } from './refunds.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CreateRefundDto } from './dto/create-refund.dto';
const org = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const branch = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sale = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const item = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const actor = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const requestId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const context = {
  organizationId: org,
  userId: actor,
  role: 'OWNER' as const,
  merchantId: null,
};
const dto: CreateRefundDto = {
  requestId,
  reason: 'Returned goods',
  paymentMethod: 'CASH',
  refundConfirmed: true,
  items: [{ saleItemId: item, quantity: 2, restockQuantity: 1 }],
};
const saved = {
  id: 'refund',
  organizationId: org,
  branchId: branch,
  saleId: sale,
  refundCode: 'REFUND-TEST',
  completedAt: new Date(),
  reason: dto.reason,
  paymentMethod: 'CASH',
  paymentReference: null,
  total: new Prisma.Decimal('25.00'),
  sale: { receiptCode: 'SALE-TEST' },
  items: [
    {
      id: 'refund-item',
      saleItemId: item,
      branchInventoryId: 'inventory',
      merchantId: 'merchant',
      quantity: 2,
      restockQuantity: 1,
      unitPrice: new Prisma.Decimal('12.50'),
      lineTotal: new Prisma.Decimal('25.00'),
      saleItem: {
        productId: 'product',
        productName: 'Saved goods',
        sku: null,
        barcode: null,
        merchantName: 'Saved business',
      },
    },
  ],
};
describe('RefundsService', () => {
  const tx = {
    organizationMembership: { findUnique: jest.fn() },
    branch: { findFirst: jest.fn() },
    saleItem: { findMany: jest.fn() },
    refundItem: { groupBy: jest.fn(), create: jest.fn() },
    refund: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    branchInventory: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    inventoryMovement: { create: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const prisma = { $transaction: jest.fn() };
  const service = new RefundsService(prisma as unknown as PrismaService);
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    tx.organizationMembership.findUnique.mockResolvedValue({ role: 'OWNER' });
    tx.branch.findFirst.mockResolvedValue({ id: branch });
    tx.$queryRaw.mockResolvedValue([{ id: sale }]);
    tx.refund.findUnique.mockResolvedValue(null);
    tx.saleItem.findMany.mockResolvedValue([
      {
        id: item,
        branchInventoryId: 'inventory',
        merchantId: 'merchant',
        quantity: 3,
        unitPrice: new Prisma.Decimal('12.50'),
      },
    ]);
    tx.refundItem.groupBy.mockResolvedValue([]);
    tx.refund.create.mockResolvedValue({
      id: saved.id,
      completedAt: saved.completedAt,
    });
    tx.refundItem.create.mockResolvedValue({ id: 'refund-item' });
    tx.branchInventory.updateMany.mockResolvedValue({ count: 1 });
    tx.branchInventory.findUniqueOrThrow.mockResolvedValue({ quantity: 4 });
    tx.refund.findUniqueOrThrow.mockResolvedValue(saved);
  });
  it('derives original amounts, increments only original stock and hides private data', async () => {
    const response = await service.complete(context, branch, sale, dto);
    expect(response).toMatchObject({
      scope: 'STAFF',
      total: '25.00',
      items: [{ unitPrice: '12.50', lineTotal: '25.00' }],
    });
    expect(response).not.toHaveProperty('requestId');
    expect(response).not.toHaveProperty('refundCommand');
    expect(response).not.toHaveProperty('createdById');
    const createCalls = tx.refund.create.mock.calls as [
      { data: { total: Prisma.Decimal } },
    ][];
    const created = createCalls[0][0];
    expect(created.data.total.toFixed(2)).toBe('25.00');
    expect(tx.branchInventory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'inventory',
          organizationId: org,
          branchId: branch,
          quantity: { lte: 2147483646 },
        },
        data: { quantity: { increment: 1 } },
      }),
    );
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'RETURN',
          refundItemId: 'refund-item',
          quantityChange: 1,
          quantityAfter: 4,
          createdById: actor,
        }) as unknown,
      }),
    );
  });
  it('creates no movement or stock update for zero restocking', async () => {
    await service.complete(context, branch, sale, {
      ...dto,
      items: [{ ...dto.items[0], restockQuantity: 0 }],
    });
    expect(tx.branchInventory.updateMany).not.toHaveBeenCalled();
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });
  it.each(['MANAGER', 'CASHIER', 'MERCHANT'])(
    'uses current membership rather than stale OWNER context: %s',
    async (role) => {
      tx.organizationMembership.findUnique.mockResolvedValue({ role });
      if (role === 'MANAGER') {
        await service.complete(context, branch, sale, dto);
        const lookupCalls = tx.branch.findFirst.mock.calls as [
          { where: { AND: unknown[] } },
        ][];
        const lookup = lookupCalls[0][0];
        expect(lookup.where.AND[0]).toMatchObject({
          organizationId: org,
          memberships: { some: { organizationId: org, userId: actor } },
        });
      } else {
        await expect(
          service.complete(context, branch, sale, dto),
        ).rejects.toThrow('cannot issue refunds');
        expect(tx.refund.create).not.toHaveBeenCalled();
      }
    },
  );
  it.each(['membership', 'branch', 'sale', 'item'])(
    'denies missing/foreign %s before writes',
    async (missing) => {
      if (missing === 'membership')
        tx.organizationMembership.findUnique.mockResolvedValue(null);
      if (missing === 'branch') tx.branch.findFirst.mockResolvedValue(null);
      if (missing === 'sale') tx.$queryRaw.mockResolvedValue([]);
      if (missing === 'item') tx.saleItem.findMany.mockResolvedValue([]);
      await expect(
        service.complete(context, branch, sale, dto),
      ).rejects.toThrow('not found');
      expect(tx.refund.create).not.toHaveBeenCalled();
    },
  );
  it('rejects cumulative over-return before any writes', async () => {
    tx.refundItem.groupBy.mockResolvedValue([
      { saleItemId: item, _sum: { quantity: 2 } },
    ]);
    await expect(
      service.complete(context, branch, sale, dto),
    ).rejects.toMatchObject({ response: { code: 'RETURN_QUANTITY_EXCEEDED' } });
    expect(tx.refund.create).not.toHaveBeenCalled();
  });
  it('rejects stock overflow instead of changing refund restocking', async () => {
    tx.branchInventory.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.complete(context, branch, sale, dto),
    ).rejects.toMatchObject({ response: { code: 'STOCK_OVERFLOW' } });
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });
  const original = () => ({
    ...saved,
    createdById: actor,
    refundCommand: {
      items: dto.items,
      reason: dto.reason,
      paymentMethod: 'CASH',
      refundConfirmed: true,
    },
  });
  it('replays before remaining/lifecycle/stock reads, with normalized input', async () => {
    tx.refund.findUnique.mockResolvedValue(original());
    await service.complete(context, branch, sale, {
      ...dto,
      requestId: requestId.toUpperCase(),
      reason: ' Returned goods ',
      items: [{ ...dto.items[0], saleItemId: item.toUpperCase() }],
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.refundItem.groupBy).not.toHaveBeenCalled();
    expect(tx.refund.create).not.toHaveBeenCalled();
  });
  it.each(['actor', 'branch', 'sale', 'reason', 'quantity', 'restock'])(
    'rejects conflicting replay %s without returning the private command',
    async (change) => {
      tx.refund.findUnique.mockResolvedValue({
        ...original(),
        ...(change === 'actor'
          ? { createdById: 'other' }
          : change === 'branch'
            ? { branchId: 'other' }
            : change === 'sale'
              ? { saleId: 'other' }
              : {}),
      });
      const changed = {
        ...dto,
        ...(change === 'reason' ? { reason: 'Different' } : {}),
        items: [
          {
            ...dto.items[0],
            ...(change === 'quantity'
              ? { quantity: 1 }
              : change === 'restock'
                ? { restockQuantity: 0 }
                : {}),
          },
        ],
      };
      await expect(
        service.complete(context, branch, sale, changed),
      ).rejects.toMatchObject({ response: { code: 'REQUEST_ID_CONFLICT' } });
      expect(tx.refund.create).not.toHaveBeenCalled();
    },
  );
  it.each(['P2002', 'P2034', '40001', '40P01'])(
    'maps %s after rollback to explicit unchanged-ID retry',
    async (code) => {
      const error = new Prisma.PrismaClientKnownRequestError('Conflict', {
        code: code.startsWith('P') ? code : 'P2010',
        clientVersion: 'test',
        meta: { driverAdapterError: { cause: { originalCode: code } } },
      });
      prisma.$transaction.mockRejectedValueOnce(error);
      await expect(
        service.complete(context, branch, sale, dto),
      ).rejects.toMatchObject({ response: { code: 'REFUND_RETRY' } });
      expect(tx.refund.create).not.toHaveBeenCalled();
    },
  );
  it('resolves a simultaneously committed identical refund after rollback with fresh authorization', async () => {
    prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    tx.refund.findUnique.mockResolvedValue(original());
    expect(await service.complete(context, branch, sale, dto)).toMatchObject({
      id: saved.id,
    });
    expect(tx.organizationMembership.findUnique).toHaveBeenCalled();
    expect(tx.refund.create).not.toHaveBeenCalled();
  });
  it('does not hide unrelated database failures or issue another refund', async () => {
    tx.refund.create.mockRejectedValue(new Error('Storage failure'));
    await expect(service.complete(context, branch, sale, dto)).rejects.toThrow(
      'Storage failure',
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid confirmation/duplicate/restock inputs at service boundary', async () => {
    for (const invalid of [
      { ...dto, refundConfirmed: false },
      { ...dto, items: [dto.items[0], dto.items[0]] },
      { ...dto, items: [{ ...dto.items[0], restockQuantity: 3 }] },
    ])
      await expect(
        service.complete(context, branch, sale, invalid),
      ).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
