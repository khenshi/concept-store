import { ConflictException } from '@nestjs/common';
import {
  AgreementStatus,
  MerchantFinanceAccrualKind,
  Prisma,
  SettlementSchedule,
} from '../../generated/prisma/client';
import { MerchantFinanceAccrualService } from './merchant-finance-accrual.service';

describe('MerchantFinanceAccrualService', () => {
  const organizationId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const merchantId = '9ec877c5-d000-4d3f-99b1-a6e528ce706a';
  const agreementId = 'be9adae3-39c9-4471-9755-efea70a84ed3';
  const completedAt = new Date('2026-09-08T04:00:00.000Z');
  const agreement = {
    id: agreementId,
    organizationId,
    merchantId,
    startDate: new Date('2026-09-05T00:00:00.000Z'),
    endDate: null,
    durationMonths: 12,
    activatedAt: completedAt,
    scheduledEndDate: new Date('2027-09-05T00:00:00.000Z'),
    endedAt: null,
    endedById: null,
    endReason: null,
    fixedRentAmount: new Prisma.Decimal('2500.00'),
    commissionRate: new Prisma.Decimal('5.00'),
    settlementSchedule: SettlementSchedule.MONTHLY,
    status: AgreementStatus.ACTIVE,
    createdAt: completedAt,
    updatedAt: completedAt,
  };
  const transaction = {
    merchantAgreement: { findMany: jest.fn() },
    merchantFinanceAccrual: { findUnique: jest.fn() },
    $executeRaw: jest.fn(),
  };
  let service: MerchantFinanceAccrualService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MerchantFinanceAccrualService();
    transaction.merchantAgreement.findMany.mockResolvedValue([agreement]);
    transaction.$executeRaw.mockResolvedValue(1);
  });

  it('aggregates sale lines into one tenant-scoped agreement-period bucket', async () => {
    const buckets = await service.prepareCompletedSale(
      transaction as unknown as Prisma.TransactionClient,
      organizationId,
      completedAt,
      [
        { merchantId, amount: new Prisma.Decimal('100.00') },
        { merchantId, amount: new Prisma.Decimal('250.00') },
      ],
    );

    expect(transaction.merchantAgreement.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
        merchantId: { in: [merchantId] },
        status: { in: [AgreementStatus.ACTIVE] },
        startDate: { lte: new Date('2026-09-08T00:00:00.000Z') },
        OR: [
          { endDate: null },
          { endDate: { gte: new Date('2026-09-08T00:00:00.000Z') } },
        ],
      },
      orderBy: [{ merchantId: 'asc' }, { startDate: 'desc' }, { id: 'asc' }],
    });
    expect(buckets).toEqual([
      {
        organizationId,
        merchantId,
        agreementId,
        periodStart: new Date('2026-09-05T00:00:00.000Z'),
        periodEnd: new Date('2026-09-30T00:00:00.000Z'),
        schedule: SettlementSchedule.MONTHLY,
        kind: MerchantFinanceAccrualKind.EARNED_ACTIVITY,
        commissionRate: new Prisma.Decimal('5.00'),
        grossSales: new Prisma.Decimal('350.00'),
      },
    ]);
  });

  it('rejects checkout when any merchant has no effective active agreement', async () => {
    transaction.merchantAgreement.findMany.mockResolvedValue([]);

    await expect(
      service.prepareCompletedSale(
        transaction as unknown as Prisma.TransactionClient,
        organizationId,
        completedAt,
        [{ merchantId, amount: new Prisma.Decimal('100.00') }],
      ),
    ).rejects.toThrow(
      new ConflictException(
        'Every merchant in the cart requires an active agreement before checkout',
      ),
    );
  });

  it('prepares multiple merchants in one agreement query and stable order', async () => {
    const secondMerchantId = 'd3a2a617-df42-4fef-b244-6137305acd83';
    const secondAgreementId = '317ab118-889d-4f57-8f64-4b61462f26fd';
    transaction.merchantAgreement.findMany.mockResolvedValue([
      agreement,
      {
        ...agreement,
        id: secondAgreementId,
        merchantId: secondMerchantId,
        commissionRate: null,
      },
    ]);

    const buckets = await service.prepareCompletedSale(
      transaction as unknown as Prisma.TransactionClient,
      organizationId,
      completedAt,
      [
        { merchantId: secondMerchantId, amount: new Prisma.Decimal('50.00') },
        { merchantId, amount: new Prisma.Decimal('100.00') },
      ],
    );

    expect(buckets.map(({ merchantId: id }) => id)).toEqual([
      merchantId,
      secondMerchantId,
    ]);
    expect(transaction.merchantAgreement.findMany).toHaveBeenCalledTimes(1);
  });

  it('stores period-rounded commission for a commission agreement', async () => {
    const [bucket] = await service.prepareCompletedSale(
      transaction as unknown as Prisma.TransactionClient,
      organizationId,
      completedAt,
      [{ merchantId, amount: new Prisma.Decimal('350.00') }],
    );

    await service.addCompletedSale(
      transaction as unknown as Prisma.TransactionClient,
      [bucket],
    );

    const calls = transaction.$executeRaw.mock.calls as unknown as [
      [Prisma.Sql],
    ];
    expect(calls[0][0].values[9]).toEqual(new Prisma.Decimal('17.50'));
  });

  it('writes a completed rent-only sale with zero commission', async () => {
    const bucket = {
      organizationId,
      merchantId,
      agreementId,
      periodStart: new Date('2026-09-05T00:00:00.000Z'),
      periodEnd: new Date('2026-09-30T00:00:00.000Z'),
      schedule: SettlementSchedule.MONTHLY,
      kind: MerchantFinanceAccrualKind.EARNED_ACTIVITY,
      commissionRate: null,
      grossSales: new Prisma.Decimal('350.00'),
    };

    await service.addCompletedSale(
      transaction as unknown as Prisma.TransactionClient,
      [bucket],
    );

    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
    const calls = transaction.$executeRaw.mock.calls as unknown as [
      [Prisma.Sql],
    ];
    expect(calls[0][0].values[9]).toEqual(new Prisma.Decimal(0));
  });

  it('allows a pre-backfill sale void when no projection bucket exists', async () => {
    transaction.merchantFinanceAccrual.findUnique.mockResolvedValue(null);

    await service.removeCompletedSale(
      transaction as unknown as Prisma.TransactionClient,
      [
        {
          organizationId,
          merchantId,
          agreementId,
          periodStart: new Date('2026-09-05T00:00:00.000Z'),
          periodEnd: new Date('2026-09-30T00:00:00.000Z'),
          schedule: SettlementSchedule.MONTHLY,
          kind: MerchantFinanceAccrualKind.EARNED_ACTIVITY,
          commissionRate: agreement.commissionRate,
          grossSales: new Prisma.Decimal('350.00'),
        },
      ],
    );

    expect(transaction.$executeRaw).not.toHaveBeenCalled();
  });

  it('rejects a void that exceeds the projected gross balance', async () => {
    transaction.merchantFinanceAccrual.findUnique.mockResolvedValue({
      grossSales: new Prisma.Decimal('349.99'),
    });

    await expect(
      service.removeCompletedSale(
        transaction as unknown as Prisma.TransactionClient,
        [
          {
            organizationId,
            merchantId,
            agreementId,
            periodStart: new Date('2026-09-05T00:00:00.000Z'),
            periodEnd: new Date('2026-09-30T00:00:00.000Z'),
            schedule: SettlementSchedule.MONTHLY,
            kind: MerchantFinanceAccrualKind.EARNED_ACTIVITY,
            commissionRate: agreement.commissionRate,
            grossSales: new Prisma.Decimal('350.00'),
          },
        ],
      ),
    ).rejects.toThrow('Merchant payable projection is inconsistent');
  });
});
