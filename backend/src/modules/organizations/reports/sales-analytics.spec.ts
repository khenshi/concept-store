import { Prisma } from '../../../generated/prisma/client';
import { intersectingManilaDates, readAnalytics } from './sales-analytics';

describe('Sales analytics', () => {
  it('zero-fills half-open Manila dates including partial days and the 367-date API bound', () => {
    expect(
      intersectingManilaDates(
        new Date('2026-09-01T15:59:59.999Z'),
        new Date('2026-09-02T16:00:00Z'),
      ),
    ).toEqual(['2026-09-01', '2026-09-02']);
    expect(
      intersectingManilaDates(
        new Date('2026-09-01T16:00:00Z'),
        new Date('2026-09-01T16:00:00.001Z'),
      ),
    ).toEqual(['2026-09-02']);
    const from = new Date('2026-01-01T00:00:00Z');
    expect(
      intersectingManilaDates(from, new Date(from.getTime() + 366 * 86400000)),
    ).toHaveLength(367);
  });
  it('does not query history for an assigned unlinked merchant and returns only own zeros', async () => {
    const raw = jest.fn();
    const result = await readAnalytics(
      { $queryRaw: raw } as unknown as Prisma.TransactionClient,
      {
        organizationId: 'org',
        userId: 'user',
        role: 'MERCHANT',
        merchantId: null,
      },
      'branch',
      new Date('2026-09-01T16:00:00Z'),
      new Date('2026-09-02T16:00:00Z'),
    );
    expect(raw).not.toHaveBeenCalled();
    expect(result).toEqual({
      dailyTrends: [
        {
          date: '2026-09-02',
          ownGrossSales: '0.00',
          ownUnitsSold: '0',
          ownRefundedAmount: '0.00',
          ownReturnedUnits: '0',
          ownNetRecordedSales: '0.00',
          ownTransactionCount: '0',
          ownRefundCount: '0',
        },
      ],
      topProducts: [],
      totalProducts: '0',
    });
  });
  it('binds tenant, branch, profile and times, with exact signed arithmetic and no private fields', async () => {
    const raw = jest
      .fn()
      .mockResolvedValueOnce([
        {
          date: '2026-09-02',
          grossSales: '999999999999999999999999.99',
          unitsSold: '99999999999999999',
          transactionCount: '1',
          refundedAmount: '1000000000000000000000000.00',
          returnedUnits: '99999999999999999',
          refundCount: '1',
        },
      ])
      .mockResolvedValueOnce([]);
    const result = await readAnalytics(
      { $queryRaw: raw } as unknown as Prisma.TransactionClient,
      {
        organizationId: 'org',
        userId: 'user',
        role: 'MERCHANT',
        merchantId: 'own',
      },
      'branch',
      new Date('2026-09-01T16:00:00Z'),
      new Date('2026-09-02T16:00:00Z'),
    );
    expect(result.dailyTrends[0]).toHaveProperty(
      'ownNetRecordedSales',
      '-0.01',
    );
    for (const [sql] of raw.mock.calls as [Prisma.Sql][]) {
      expect(sql.values).toEqual(
        expect.arrayContaining(['org', 'branch', 'own']),
      );
      expect(sql.sql).not.toMatch(
        /paymentMethod|reason|checkoutCommand|refundCommand|contactName|createdById/,
      );
    }
    expect((raw.mock.calls[1] as [Prisma.Sql])[0].sql).toContain('LIMIT 10');
  });
});
