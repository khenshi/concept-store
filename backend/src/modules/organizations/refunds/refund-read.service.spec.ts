import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { RefundReadService } from './refund-read.service';
import { merchantRefundSelect } from './refund-read.types';
import { branchRefundSummarySelect } from './branch-refund-read.types';
import { ListBranchRefundsQueryDto } from './dto/list-branch-refunds-query.dto';
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
  it('returns only branch summaries and exact totals in a single authorized snapshot', async () => {
    tx.refund.findMany.mockResolvedValue([
      {
        id: 'refund',
        saleId: 'sale',
        refundCode: 'RF-1',
        completedAt: new Date('2026-10-21T00:00:00Z'),
        paymentAccountId: 'GCASH',
        total: new Prisma.Decimal('1234567890123456789012.34'),
        sale: { receiptCode: 'RC-1' },
      },
    ]);
    const result = await service.findBranchHistory(
      context,
      'branch',
      new ListBranchRefundsQueryDto(),
    );
    expect(result).toEqual({
      scope: 'STAFF',
      organizationId: 'org',
      branchId: 'branch',
      page: 1,
      limit: 15,
      total: 3,
      totalPages: 1,
      items: [
        {
          id: 'refund',
          saleId: 'sale',
          refundCode: 'RF-1',
          receiptCode: 'RC-1',
          completedAt: new Date('2026-10-21T00:00:00Z'),
          paymentAccountId: 'GCASH',
          total: '1234567890123456789012.34',
        },
      ],
    });
    expect(tx.refund.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org', branchId: 'branch' },
      skip: 0,
      take: 15,
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      select: branchRefundSummarySelect,
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
    expect(tx.organizationMembership.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_userId: { organizationId: 'org', userId: 'user' },
          user: { deletedAt: null, emailVerifiedAt: { not: null } },
        },
      }),
    );
    expect(tx.sale.findFirst).not.toHaveBeenCalled();
    expect(tx.saleItem.findMany).not.toHaveBeenCalled();
    expect(tx.refundItem.groupBy).not.toHaveBeenCalled();
  });
  it('uses identical combined predicates for count and page, escaping literal LIKE metacharacters', async () => {
    await service.findBranchHistory(context, 'branch', {
      page: 2,
      limit: 100,
      q: 'a%_\\b',
      paymentAccountId: 'CARD',
      from: '0001-01-01T00:00:00Z',
      until: '9999-12-31T23:59:59.999Z',
    });
    const where = {
      organizationId: 'org',
      branchId: 'branch',
      paymentAccountId: 'CARD',
      completedAt: {
        gte: new Date('0001-01-01T00:00:00Z'),
        lt: new Date('9999-12-31T23:59:59.999Z'),
      },
      OR: [
        { refundCode: { contains: 'a\\%\\_\\\\b', mode: 'insensitive' } },
        {
          sale: {
            receiptCode: { contains: 'a\\%\\_\\\\b', mode: 'insensitive' },
          },
        },
      ],
    };
    expect(tx.refund.count).toHaveBeenCalledWith({ where });
    expect(tx.refund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 100, take: 100 }),
    );
  });
  it.each(['CASHIER', 'MERCHANT'])(
    'denies current %s branch history even with a stale OWNER context',
    async (role) => {
      tx.organizationMembership.findUnique.mockResolvedValue({
        role,
        merchantId: 'merchant',
      });
      await expect(
        service.findBranchHistory(
          context,
          'branch',
          new ListBranchRefundsQueryDto(),
        ),
      ).rejects.toThrow('cannot read refunds');
      expect(tx.refund.count).not.toHaveBeenCalled();
      expect(tx.branch.findFirst).not.toHaveBeenCalled();
    },
  );
  it.each(['member', 'branch'])(
    'denies missing current %s for branch history before any refund query',
    async (missing) => {
      if (missing === 'member')
        tx.organizationMembership.findUnique.mockResolvedValue(null);
      else tx.branch.findFirst.mockResolvedValue(null);
      await expect(
        service.findBranchHistory(
          context,
          'branch',
          new ListBranchRefundsQueryDto(),
        ),
      ).rejects.toThrow('not found');
      expect(tx.refund.count).not.toHaveBeenCalled();
    },
  );
  it('checks current manager assignments for branch history', async () => {
    tx.organizationMembership.findUnique.mockResolvedValue({
      role: 'MANAGER',
      merchantId: null,
    });
    await service.findBranchHistory(
      context,
      'branch',
      new ListBranchRefundsQueryDto(),
    );
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
  it.each([
    { from: '2026-10-21T00:00:00Z' },
    { until: '2026-10-21T00:00:00Z' },
    { from: 'bad', until: '2026-10-21T00:00:00Z' },
    { from: '2026-10-21T00:00:00Z', until: '2026-10-21T00:00:00Z' },
    { from: '2026-10-22T00:00:00Z', until: '2026-10-21T00:00:00Z' },
    { from: '0000-12-31T23:59:59Z', until: '2026-10-21T00:00:00Z' },
    { from: '2026-10-21T00:00:00Z', until: '+010000-01-01T00:00:00Z' },
  ])('rejects unsupported or unpaired bounds %j', async (bounds) => {
    await expect(
      service.findBranchHistory(context, 'branch', {
        ...new ListBranchRefundsQueryDto(),
        ...bounds,
      }),
    ).rejects.toThrow('paired, ordered UTC bounds');
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
      'paymentAccountId',
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
