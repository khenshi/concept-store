import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { SalesReadService } from './sales-read.service';

describe('SalesReadService scoped history filters', () => {
  const tx = {
    organizationMembership: { findUnique: jest.fn() },
    branch: { findFirst: jest.fn() },
    sale: { count: jest.fn(), findMany: jest.fn() },
  };
  const prisma = { $transaction: jest.fn() };
  const service = new SalesReadService(prisma as unknown as PrismaService);
  const context = {
    organizationId: 'org',
    userId: 'actor',
    role: 'OWNER' as const,
  };

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
    tx.sale.count.mockResolvedValue(0);
    tx.sale.findMany.mockResolvedValue([]);
  });

  it('applies combined staff filters before count and pagination', async () => {
    await service.findAll(context, 'branch', {
      q: 'SALE-001',
      cashierId: 'cashier',
      paymentMethod: 'CARD',
      from: '2026-09-12T16:00:00.000Z',
      until: '2026-09-13T16:00:00.000Z',
      page: 2,
      limit: 10,
    });
    const expectedWhere: Prisma.SaleWhereInput = {
      organizationId: 'org',
      branchId: 'branch',
      receiptCode: { contains: 'SALE-001', mode: 'insensitive' },
      createdById: 'cashier',
      paymentMethod: 'CARD',
      completedAt: {
        gte: new Date('2026-09-12T16:00:00.000Z'),
        lt: new Date('2026-09-13T16:00:00.000Z'),
      },
    };
    expect(tx.sale.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(tx.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
        skip: 10,
        take: 10,
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });

  it('derives manager and cashier scope from current membership and branch access', async () => {
    tx.organizationMembership.findUnique.mockResolvedValue({
      role: 'MANAGER',
      merchantId: null,
    });
    await service.findAll(context, 'branch', { page: 1, limit: 10 });
    expect(tx.branch.findFirst).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            organizationId: 'org',
            memberships: { some: { organizationId: 'org', userId: 'actor' } },
          },
          { id: 'branch' },
        ],
      },
      select: { id: true },
    });

    tx.organizationMembership.findUnique.mockResolvedValue({
      role: 'CASHIER',
      merchantId: null,
    });
    await service.findAll({ ...context, role: 'CASHIER' }, 'branch', {
      page: 1,
      limit: 10,
    });
    expect(tx.sale.count).toHaveBeenLastCalledWith({
      where: {
        organizationId: 'org',
        branchId: 'branch',
        createdById: 'actor',
      },
    });
  });

  it('returns scoped cashier options and denies merchants', async () => {
    tx.sale.findMany.mockResolvedValue([
      { createdById: 'cashier-1', cashierName: 'A Cashier' },
      { createdById: 'cashier-2', cashierName: 'B Cashier' },
    ]);
    await expect(service.listCashiers(context, 'branch')).resolves.toEqual([
      { id: 'cashier-1', name: 'A Cashier' },
      { id: 'cashier-2', name: 'B Cashier' },
    ]);
    expect(tx.sale.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org', branchId: 'branch' },
      select: { createdById: true, cashierName: true },
      distinct: ['createdById'],
      orderBy: [{ cashierName: 'asc' }, { createdById: 'asc' }],
    });

    tx.organizationMembership.findUnique.mockResolvedValue({
      role: 'MERCHANT',
      merchantId: 'merchant',
    });
    await expect(
      service.listCashiers({ ...context, role: 'MERCHANT' }, 'branch'),
    ).rejects.toThrow('Only staff');
    expect(tx.sale.findMany).toHaveBeenCalledTimes(1);
  });

  it('does not read sales after branch denial and rejects reversed bounds', async () => {
    tx.branch.findFirst.mockResolvedValue(null);
    await expect(
      service.findAll(context, 'foreign-branch', { page: 1, limit: 10 }),
    ).rejects.toThrow('Branch not found');
    expect(tx.sale.count).not.toHaveBeenCalled();

    await expect(
      service.findAll(context, 'branch', {
        from: '2026-09-14T00:00:00Z',
        until: '2026-09-13T00:00:00Z',
        page: 1,
        limit: 10,
      }),
    ).rejects.toThrow('from must precede until');
  });
});
