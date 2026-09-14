import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const tx = {
    organizationMembership: { findUnique: jest.fn() },
    branch: { findFirst: jest.fn(), findMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const prisma = { $transaction: jest.fn() };
  const service = new ReportsService(prisma as unknown as PrismaService);
  const context = {
    organizationId: 'org',
    userId: 'actor',
    role: 'OWNER' as const,
  };
  const query = { from: '2026-09-01T00:00:00Z', until: '2026-09-02T00:00:00Z' };
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    tx.organizationMembership.findUnique.mockResolvedValue({
      role: 'OWNER',
      merchantId: null,
    });
    tx.branch.findFirst.mockResolvedValue({
      id: 'branch',
      name: 'Branch',
      code: null,
    });
    tx.branch.findMany.mockResolvedValue([]);
    tx.$queryRaw
      .mockResolvedValueOnce([
        { grossSales: '25.00', transactionCount: '1', unitsSold: '2' },
      ])
      .mockResolvedValueOnce([
        { paymentMethod: 'CASH', grossSales: '25.00', transactionCount: '1' },
      ]);
  });
  it('uses one repeatable-read snapshot and zero-fills a fixed payment breakdown', async () => {
    await expect(
      service.sales(context, 'branch', query),
    ).resolves.toMatchObject({
      scope: 'STAFF',
      grossSales: '25.00',
      transactionCount: '1',
      unitsSold: '2',
      payments: [
        { paymentMethod: 'CASH', grossSales: '25.00', transactionCount: '1' },
        { paymentMethod: 'GCASH', grossSales: '0.00', transactionCount: '0' },
        { paymentMethod: 'CARD', grossSales: '0.00', transactionCount: '0' },
      ],
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
    expect(tx.organizationMembership.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: { organizationId: 'org', userId: 'actor' },
        user: { deletedAt: null },
      },
      select: { role: true, merchantId: true },
    });
    const sql = (tx.$queryRaw.mock.calls[0] as [Prisma.Sql])[0];
    expect(sql.values).toContain('org');
    expect(sql.values).toContain('branch');
    expect(sql.sql).toContain('"completedAt" >=');
    expect(sql.sql).toContain('"completedAt" <');
  });
  it('derives the current manager scope rather than trusting an earlier owner role', async () => {
    tx.organizationMembership.findUnique.mockResolvedValue({
      role: 'MANAGER',
      merchantId: null,
    });
    await service.sales(context, 'branch', query);
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
      select: { id: true, name: true, code: true },
    });
  });
  it('uses only own item columns for a freshly linked merchant and never queries payments', async () => {
    tx.organizationMembership.findUnique.mockResolvedValue({
      role: 'MERCHANT',
      merchantId: 'linked',
    });
    const result = await service.sales(context, 'branch', query);
    expect(Object.keys(result).sort()).toEqual(
      [
        'branch',
        'from',
        'until',
        'scope',
        'ownGrossSales',
        'ownTransactionCount',
        'ownUnitsSold',
      ].sort(),
    );
    expect(result).toMatchObject({
      scope: 'MERCHANT',
      ownGrossSales: '25.00',
      ownTransactionCount: '1',
      ownUnitsSold: '2',
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = (tx.$queryRaw.mock.calls[0] as [Prisma.Sql])[0];
    expect(sql.values).toContain('linked');
    expect(sql.sql).toContain('COUNT(DISTINCT');
    expect(sql.sql).not.toMatch(
      /"total"|paymentMethod|cashTender|createdById|checkoutCommand/,
    );
  });
  it('returns empty own-only totals for an assigned unlinked merchant without running aggregate SQL', async () => {
    tx.organizationMembership.findUnique.mockResolvedValue({
      role: 'MERCHANT',
      merchantId: null,
    });
    await expect(
      service.sales(context, 'branch', query),
    ).resolves.toMatchObject({
      scope: 'MERCHANT',
      ownGrossSales: '0.00',
      ownTransactionCount: '0',
      ownUnitsSold: '0',
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
  it('does not round large amounts or integer strings through JavaScript numbers', async () => {
    tx.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([
        {
          grossSales: '999999999999999999999999999999.99',
          transactionCount: '9007199254740993',
          unitsSold: '18446744073709551616',
        },
      ])
      .mockResolvedValueOnce([]);
    await expect(
      service.sales(context, 'branch', query),
    ).resolves.toMatchObject({
      grossSales: '999999999999999999999999999999.99',
      transactionCount: '9007199254740993',
      unitsSold: '18446744073709551616',
    });
  });
  it.each(['sales', 'branches'] as const)(
    'denies current cashier access for %s even with stale owner context',
    async (method) => {
      tx.organizationMembership.findUnique.mockResolvedValue({
        role: 'CASHIER',
        merchantId: null,
      });
      await expect(
        method === 'sales'
          ? service.sales(context, 'branch', query)
          : service.branches(context),
      ).rejects.toMatchObject({ status: 403 });
      expect(tx.branch.findFirst).not.toHaveBeenCalled();
      expect(tx.branch.findMany).not.toHaveBeenCalled();
      expect(tx.$queryRaw).not.toHaveBeenCalled();
    },
  );
  it('denies removed/deleted membership before branch or aggregate reads', async () => {
    tx.organizationMembership.findUnique.mockResolvedValue(null);
    await expect(service.sales(context, 'branch', query)).rejects.toMatchObject(
      { status: 404 },
    );
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
  it('treats foreign, missing and inaccessible branches alike', async () => {
    tx.branch.findFirst.mockResolvedValue(null);
    await expect(service.sales(context, 'branch', query)).rejects.toMatchObject(
      { status: 404 },
    );
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
  it.each([
    { from: query.until, until: query.from },
    { from: query.from, until: query.from },
    { from: 'bad', until: query.until },
    { from: '2025-01-01T00:00:00Z', until: '2026-01-03T00:00:00Z' },
  ])('rejects invalid ranges before database access %j', async (range) => {
    await expect(service.sales(context, 'branch', range)).rejects.toMatchObject(
      { status: 400 },
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('accepts exactly 366 days', async () => {
    await expect(
      service.sales(context, 'branch', {
        from: '2024-01-01T00:00:00Z',
        until: '2025-01-01T00:00:00Z',
      }),
    ).resolves.toMatchObject({ scope: 'STAFF' });
  });
  it('looks up only identity fields under assigned plus historical own-sales scope', async () => {
    tx.organizationMembership.findUnique.mockResolvedValue({
      role: 'MERCHANT',
      merchantId: 'linked',
    });
    await service.branches(context);
    expect(tx.branch.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org',
        OR: [
          { memberships: { some: { organizationId: 'org', userId: 'actor' } } },
          {
            sales: {
              some: {
                organizationId: 'org',
                items: {
                  some: { organizationId: 'org', merchantId: 'linked' },
                },
              },
            },
          },
        ],
      },
      select: { id: true, name: true, code: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
