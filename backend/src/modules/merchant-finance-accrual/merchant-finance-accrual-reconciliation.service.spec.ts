import {
  MerchantFinanceAccrualKind,
  Prisma,
  SettlementSchedule,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MerchantFinanceAccrualReconciliationService } from './merchant-finance-accrual-reconciliation.service';
import { MerchantFinanceAccrualService } from './merchant-finance-accrual.service';

describe('MerchantFinanceAccrualReconciliationService', () => {
  const organizationId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const merchantId = '9ec877c5-d000-4d3f-99b1-a6e528ce706a';
  const expected = [
    {
      organizationId,
      merchantId,
      agreementId: 'be9adae3-39c9-4471-9755-efea70a84ed3',
      periodStart: new Date('2026-09-01T00:00:00.000Z'),
      periodEnd: new Date('2026-09-30T00:00:00.000Z'),
      schedule: SettlementSchedule.MONTHLY,
      kind: MerchantFinanceAccrualKind.EARNED_ACTIVITY,
      commissionRate: new Prisma.Decimal('5.00'),
      grossSales: new Prisma.Decimal('1000.00'),
      refundTotal: new Prisma.Decimal('100.00'),
      commissionAmount: new Prisma.Decimal('45.00'),
    },
  ];
  const transaction = {
    merchantFinanceAccrual: { findMany: jest.fn() },
  };
  const prisma = {
    organization: { findMany: jest.fn() },
    merchant: { findMany: jest.fn() },
    $transaction: jest.fn(
      (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    ),
  };
  const accruals = {
    calculateMerchantProjection: jest.fn(),
    rebuildMerchant: jest.fn(),
  };
  let service: MerchantFinanceAccrualReconciliationService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organization.findMany.mockResolvedValue([{ id: organizationId }]);
    prisma.merchant.findMany.mockResolvedValue([
      { id: merchantId, name: 'Demo Merchant' },
    ]);
    transaction.merchantFinanceAccrual.findMany.mockResolvedValue([]);
    accruals.calculateMerchantProjection.mockResolvedValue(expected);
    service = new MerchantFinanceAccrualReconciliationService(
      prisma as unknown as PrismaService,
      accruals as unknown as MerchantFinanceAccrualService,
    );
  });

  it('reports drift without mutating projection data by default', async () => {
    const report = await service.run({ repair: false, organizationId });

    expect(accruals.rebuildMerchant).not.toHaveBeenCalled();
    expect(report).toMatchObject({
      mode: 'REPORT',
      organizationScope: organizationId,
      merchantsChecked: 1,
      driftedMerchants: 1,
      repairedMerchants: 0,
      rows: [
        {
          status: 'DRIFT',
          expected: {
            grossSales: '1000.00',
            refunds: '100.00',
            commission: '45.00',
            payable: '855.00',
          },
          projected: {
            grossSales: '0.00',
            refunds: '0.00',
            commission: '0.00',
            payable: '0.00',
          },
          difference: {
            grossSales: '1000.00',
            refunds: '100.00',
            commission: '45.00',
            payable: '855.00',
          },
        },
      ],
    });
  });

  it('repairs only a drifted merchant when explicitly requested', async () => {
    const report = await service.run({ repair: true });

    expect(accruals.rebuildMerchant).toHaveBeenCalledWith(
      transaction,
      organizationId,
      merchantId,
    );
    expect(report.repairedMerchants).toBe(1);
    expect(report.rows[0].repaired).toBe(true);
  });

  it('is idempotent when repair is repeated against matching buckets', async () => {
    transaction.merchantFinanceAccrual.findMany.mockResolvedValue(expected);

    const report = await service.run({ repair: true, organizationId });

    expect(report.matchingMerchants).toBe(1);
    expect(report.driftedMerchants).toBe(0);
    expect(report.repairedMerchants).toBe(0);
    expect(accruals.rebuildMerchant).not.toHaveBeenCalled();
    expect(transaction.merchantFinanceAccrual.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId, merchantId } }),
    );
  });

  it('handles an empty all-organization database', async () => {
    prisma.organization.findMany.mockResolvedValue([]);

    await expect(service.run({ repair: false })).resolves.toMatchObject({
      organizationsChecked: 0,
      merchantsChecked: 0,
      rows: [],
    });
    expect(prisma.merchant.findMany).not.toHaveBeenCalled();
  });

  it('reports unattributable history and does not attempt repair', async () => {
    accruals.calculateMerchantProjection.mockRejectedValue(
      new Error(
        'The original sale is not covered by an effective merchant agreement',
      ),
    );

    const report = await service.run({ repair: true, organizationId });

    expect(report.blockedMerchants).toBe(1);
    expect(report.rows[0]).toMatchObject({
      status: 'BLOCKED',
      repaired: false,
      issues: [
        'The original sale is not covered by an effective merchant agreement',
      ],
    });
    expect(accruals.rebuildMerchant).not.toHaveBeenCalled();
  });

  it('propagates repair failures so the merchant transaction rolls back', async () => {
    accruals.rebuildMerchant.mockRejectedValue(
      new Error('projection replacement failed'),
    );

    await expect(service.run({ repair: true, organizationId })).rejects.toThrow(
      'projection replacement failed',
    );
  });
});
