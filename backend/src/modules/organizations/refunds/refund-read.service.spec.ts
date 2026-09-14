import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { RefundReadService } from './refund-read.service';
import { merchantRefundSelect } from './refund-read.types';
const context = {
  organizationId: 'org',
  userId: 'user',
  role: 'OWNER' as const,
};
describe('RefundReadService scopes and snapshots', () => {
  const tx = {
    organizationMembership: { findUnique: jest.fn() },
    branch: { findFirst: jest.fn() },
    sale: { findFirst: jest.fn() },
    saleItem: { findMany: jest.fn() },
    refund: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    refundItem: { groupBy: jest.fn() },
  };
  const prisma = { $transaction: jest.fn() };
  const service = new RefundReadService(prisma as unknown as PrismaService);
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    tx.organizationMembership.findUnique.mockResolvedValue({
      role: 'OWNER',
      merchantId: null,
    });
    tx.branch.findFirst.mockResolvedValue({ id: 'branch' });
    tx.sale.findFirst.mockResolvedValue({ id: 'sale' });
    tx.saleItem.findMany.mockResolvedValue([{ id: 'item', quantity: 10 }]);
    tx.refundItem.groupBy.mockResolvedValue([
      { saleItemId: 'item', _sum: { quantity: 6, restockQuantity: 2 } },
    ]);
    tx.refund.count.mockResolvedValue(3);
    tx.refund.findMany.mockResolvedValue([]);
  });
  it('uses repeatable read and full-scope sums independently of page bounds', async () => {
    expect(
      await service.findAll(context, 'branch', 'sale', { page: 2, limit: 1 }),
    ).toMatchObject({
      scope: 'STAFF',
      total: 3,
      totalPages: 3,
      remainingItems: [
        {
          soldQuantity: 10,
          returnedQuantity: 6,
          restockedQuantity: 2,
          remainingQuantity: 4,
        },
      ],
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
    expect(tx.refundItem.groupBy).toHaveBeenCalledWith({
      by: ['saleItemId'],
      where: { organizationId: 'org', branchId: 'branch', saleId: 'sale' },
      _sum: { quantity: true, restockQuantity: true },
    });
    expect(tx.refund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        take: 1,
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });
  it('derives merchant scope from current linked profile, not stale OWNER context', async () => {
    tx.organizationMembership.findUnique.mockResolvedValue({
      role: 'MERCHANT',
      merchantId: 'current',
    });
    const result = await service.findAll(context, 'branch', 'sale', {
      page: 1,
      limit: 50,
    });
    expect(result.scope).toBe('MERCHANT');
    expect(tx.branch.findFirst).not.toHaveBeenCalled();
    expect(tx.sale.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org',
        branchId: 'branch',
        id: 'sale',
        items: {
          some: {
            organizationId: 'org',
            branchId: 'branch',
            saleId: 'sale',
            merchantId: 'current',
          },
        },
      },
      select: { id: true },
    });
    expect(tx.saleItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org',
          branchId: 'branch',
          saleId: 'sale',
          merchantId: 'current',
        },
        select: { id: true, quantity: true },
      }),
    );
    expect(tx.refund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: merchantRefundSelect('org', 'branch', 'sale', 'current'),
      }),
    );
  });
  it('uses assignment-only manager branch access from the current role', async () => {
    tx.organizationMembership.findUnique.mockResolvedValue({
      role: 'MANAGER',
      merchantId: null,
    });
    await service.findAll(context, 'branch', 'sale', { page: 1, limit: 50 });
    expect(tx.branch.findFirst).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            organizationId: 'org',
            memberships: { some: { organizationId: 'org', userId: 'user' } },
          },
          { id: 'branch' },
        ],
      },
      select: { id: true },
    });
  });
  it.each(['member', 'branch', 'sale'])(
    'denies inaccessible %s before reading refunds',
    async (missing) => {
      if (missing === 'member')
        tx.organizationMembership.findUnique.mockResolvedValue(null);
      if (missing === 'branch') tx.branch.findFirst.mockResolvedValue(null);
      if (missing === 'sale') tx.sale.findFirst.mockResolvedValue(null);
      await expect(
        service.findAll(context, 'branch', 'sale', { page: 1, limit: 50 }),
      ).rejects.toThrow('not found');
      await expect(
        service.findOne(context, 'branch', 'sale', 'refund'),
      ).rejects.toThrow('not found');
      expect(tx.refund.count).not.toHaveBeenCalled();
      expect(tx.refund.findFirst).not.toHaveBeenCalled();
    },
  );
  it('denies current cashier before refund selections', async () => {
    tx.organizationMembership.findUnique.mockResolvedValue({
      role: 'CASHIER',
      merchantId: null,
    });
    await expect(
      service.findAll(context, 'branch', 'sale', { page: 1, limit: 50 }),
    ).rejects.toThrow('cannot read refunds');
    await expect(
      service.findOne(context, 'branch', 'sale', 'refund'),
    ).rejects.toThrow('cannot read refunds');
    expect(tx.sale.findFirst).not.toHaveBeenCalled();
  });
  it('uses indistinguishable not-found for unlinked merchant source sales', async () => {
    tx.organizationMembership.findUnique.mockResolvedValue({
      role: 'MERCHANT',
      merchantId: null,
    });
    tx.sale.findFirst.mockResolvedValue(null);
    await expect(
      service.findAll(context, 'branch', 'sale', { page: 1, limit: 50 }),
    ).rejects.toThrow('Sale not found');
    expect(tx.sale.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org', branchId: 'branch', id: { in: [] } },
      select: { id: true },
    });
  });
  it('keeps detail refund ID tenant/branch/sale scoped and filters merchant ownership', async () => {
    tx.organizationMembership.findUnique.mockResolvedValue({
      role: 'MERCHANT',
      merchantId: 'current',
    });
    tx.refund.findFirst.mockResolvedValue(null);
    await expect(
      service.findOne(context, 'branch', 'sale', 'refund'),
    ).rejects.toThrow('Refund not found');
    expect(tx.refund.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org',
        branchId: 'branch',
        saleId: 'sale',
        id: 'refund',
        items: {
          some: {
            organizationId: 'org',
            branchId: 'branch',
            saleId: 'sale',
            merchantId: 'current',
          },
        },
      },
      select: merchantRefundSelect('org', 'branch', 'sale', 'current'),
    });
  });
  it('merchant selects never request private totals/payment/reason/actor/command fields', () => {
    const select = merchantRefundSelect('org', 'branch', 'sale', 'merchant');
    for (const key of [
      'total',
      'reason',
      'paymentMethod',
      'paymentReference',
      'createdById',
      'refundCommand',
      'requestId',
    ])
      expect(select).not.toHaveProperty(key);
    expect(select.items.select).not.toHaveProperty('merchantId');
    expect(select.items.select).not.toHaveProperty('branchInventoryId');
    expect(select.sale.select).toEqual({
      receiptCode: true,
      branchId: true,
      branchName: true,
      branchCode: true,
    });
  });
});
