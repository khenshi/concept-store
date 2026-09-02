import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AgreementStatus,
  OrganizationRole,
  PayoutMethod,
  Prisma,
  SettlementSchedule,
  SettlementStatus,
  RentCollectionMethod,
  RentDeductionTiming,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SettlementsService } from './settlements.service';

interface SettlementCreateArgument {
  data: {
    organizationId: string;
    merchantId: string;
    periodStart: Date;
    periodEnd: Date;
    schedule: SettlementSchedule;
    grossSales: Prisma.Decimal;
    commissionAmount: Prisma.Decimal;
    fixedRentAmount: Prisma.Decimal;
    adjustmentTotal: Prisma.Decimal;
    netPayout: Prisma.Decimal;
    calculatedById: string;
    terms: {
      create: Array<{ fixedRentAmount: Prisma.Decimal }>;
    };
  };
  select: { id: true };
}

interface SettlementSaleItemCreateManyArgument {
  data: Array<{
    settlementId: string;
    termSnapshotId: string;
    saleItemId: string;
    organizationId: string;
    merchantId: string;
    grossAmount: Prisma.Decimal;
  }>;
}

describe('SettlementsService', () => {
  const organizationId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const merchantId = '2f671678-91d3-4d04-a8f9-787a2e9f3c1a';
  const actorId = '160872ff-c20b-4cee-a58c-06a5d4431509';
  const settlementId = '5ffb99eb-261c-43ba-a548-7678c763238a';
  const createdAt = new Date('2026-08-01T00:00:00.000Z');
  const agreementBase = {
    organizationId,
    merchantId,
    settlementSchedule: SettlementSchedule.MONTHLY,
    rentCollectionMethod: RentCollectionMethod.DEDUCT_FROM_PAYOUT,
    rentDeductionTiming: RentDeductionTiming.FIRST_SETTLEMENT_OF_MONTH,
    status: AgreementStatus.ENDED,
    createdAt,
    updatedAt: createdAt,
  };
  const agreements = [
    {
      ...agreementBase,
      id: '11111111-1111-4111-8111-111111111111',
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: new Date('2026-07-15T00:00:00.000Z'),
      fixedRentAmount: new Prisma.Decimal('3100.00'),
      commissionRate: new Prisma.Decimal('10.00'),
    },
    {
      ...agreementBase,
      id: '22222222-2222-4222-8222-222222222222',
      startDate: new Date('2026-07-16T00:00:00.000Z'),
      endDate: null,
      fixedRentAmount: new Prisma.Decimal('6200.00'),
      commissionRate: new Prisma.Decimal('5.00'),
      status: AgreementStatus.ACTIVE,
    },
  ];
  const saleItems = [
    {
      id: '33333333-3333-4333-8333-333333333333',
      total: new Prisma.Decimal('1000.00'),
      sale: { completedAt: new Date('2026-07-10T04:00:00.000Z') },
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      total: new Prisma.Decimal('2000.00'),
      sale: { completedAt: new Date('2026-07-20T04:00:00.000Z') },
    },
  ];
  const transaction = {
    organizationMembership: { findUnique: jest.fn() },
    merchant: { findFirst: jest.fn() },
    merchantAgreement: { findMany: jest.fn() },
    saleItem: { findMany: jest.fn() },
    saleRefundItem: { findMany: jest.fn() },
    merchantSettlement: {
      create:
        jest.fn<(input: SettlementCreateArgument) => Promise<{ id: string }>>(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
    settlementSaleItem: {
      createMany:
        jest.fn<
          (
            input: SettlementSaleItemCreateManyArgument,
          ) => Promise<{ count: number }>
        >(),
      deleteMany: jest.fn(),
    },
    settlementRefundItem: { createMany: jest.fn(), deleteMany: jest.fn() },
    settlementTermSnapshot: { deleteMany: jest.fn(), createMany: jest.fn() },
    merchantFinanceEntry: {
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
    },
    merchantPayout: { create: jest.fn() },
    settlementAuditEvent: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    merchant: { findMany: jest.fn() },
    merchantSettlement: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      aggregate: jest.fn(),
    },
  };
  let service: SettlementsService;
  let capturedSettlementCreate: SettlementCreateArgument | undefined;
  let capturedSaleItemCreateMany:
    SettlementSaleItemCreateManyArgument | undefined;

  beforeEach(async () => {
    jest.clearAllMocks();
    capturedSettlementCreate = undefined;
    capturedSaleItemCreateMany = undefined;
    prisma.$transaction.mockImplementation(
      (
        operation:
          ((client: typeof transaction) => unknown) | Promise<unknown>[],
      ) =>
        Array.isArray(operation)
          ? Promise.all(operation)
          : operation(transaction),
    );
    transaction.organizationMembership.findUnique.mockResolvedValue({
      role: OrganizationRole.MANAGER,
    });
    transaction.merchant.findFirst.mockResolvedValue({ id: merchantId });
    transaction.merchantSettlement.findFirst.mockResolvedValue({
      id: settlementId,
      merchantId,
      periodStart: new Date('2026-07-01T00:00:00.000Z'),
      periodEnd: new Date('2026-07-31T00:00:00.000Z'),
      status: SettlementStatus.DRAFT,
      grossSales: new Prisma.Decimal('3000.00'),
      refundTotal: new Prisma.Decimal('0.00'),
      netSales: new Prisma.Decimal('3000.00'),
      commissionAmount: new Prisma.Decimal('200.00'),
      fixedRentAmount: new Prisma.Decimal('4700.00'),
    });
    transaction.merchantSettlement.updateMany.mockResolvedValue({ count: 1 });
    transaction.merchantFinanceEntry.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal('-500.00') },
    });
    transaction.merchantFinanceEntry.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal('-500.00') },
    });
    transaction.merchantFinanceEntry.create.mockResolvedValue({});
    transaction.merchantFinanceEntry.updateMany.mockResolvedValue({ count: 1 });
    transaction.merchantFinanceEntry.deleteMany.mockResolvedValue({ count: 1 });
    transaction.merchantPayout.create.mockResolvedValue({});
    transaction.settlementAuditEvent.create.mockResolvedValue({});
    transaction.settlementSaleItem.deleteMany.mockResolvedValue({ count: 2 });
    transaction.settlementRefundItem.deleteMany.mockResolvedValue({ count: 0 });
    transaction.settlementRefundItem.createMany.mockResolvedValue({ count: 0 });
    transaction.settlementTermSnapshot.deleteMany.mockResolvedValue({
      count: 2,
    });
    transaction.settlementTermSnapshot.createMany.mockResolvedValue({
      count: 2,
    });
    transaction.merchantAgreement.findMany.mockResolvedValue(agreements);
    transaction.saleItem.findMany.mockResolvedValue(saleItems);
    transaction.saleRefundItem.findMany.mockResolvedValue([]);
    transaction.merchantSettlement.create.mockImplementation(
      (input: SettlementCreateArgument) => {
        capturedSettlementCreate = input;
        return Promise.resolve({ id: settlementId });
      },
    );
    transaction.settlementSaleItem.createMany.mockImplementation(
      (input: SettlementSaleItemCreateManyArgument) => {
        capturedSaleItemCreateMany = input;
        return Promise.resolve({ count: 2 });
      },
    );
    const persistedSettlement = {
      id: settlementId,
      organizationId,
      merchantId,
      periodStart: new Date('2026-07-01T00:00:00.000Z'),
      periodEnd: new Date('2026-07-31T00:00:00.000Z'),
      schedule: SettlementSchedule.MONTHLY,
      status: SettlementStatus.DRAFT,
      grossSales: new Prisma.Decimal('3000.00'),
      refundTotal: new Prisma.Decimal('0.00'),
      netSales: new Prisma.Decimal('3000.00'),
      commissionAmount: new Prisma.Decimal('200.00'),
      fixedRentAmount: new Prisma.Decimal('4700.00'),
      rentAccruedAmount: new Prisma.Decimal('4700.00'),
      adjustmentTotal: new Prisma.Decimal('0.00'),
      netPayout: new Prisma.Decimal('-1900.00'),
      calculatedById: actorId,
      calculatedAt: createdAt,
      reviewedById: null,
      reviewedAt: null,
      approvedById: null,
      approvedAt: null,
      createdAt,
      updatedAt: createdAt,
      merchant: { id: merchantId, name: 'Amihan Goods', code: 'AMH' },
      saleItems: [],
      refundItems: [],
      terms: [],
      saleItems: [],
      financeEntries: [],
      payout: null,
    };
    transaction.merchantSettlement.findUniqueOrThrow.mockResolvedValue(
      persistedSettlement,
    );
    transaction.merchantSettlement.findFirstOrThrow.mockResolvedValue(
      persistedSettlement,
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        SettlementsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(SettlementsService);
  });

  it('keeps active merchants without agreements visible in finance', async () => {
    prisma.merchant.findMany.mockResolvedValue([
      {
        id: merchantId,
        name: 'Amihan Goods',
        code: 'AMIHAN',
        agreements: [],
        branches: [{ branch: { id: 'branch-id', name: 'Main Branch' } }],
      },
    ]);

    await expect(service.findLivePayables(organizationId)).resolves.toEqual([
      expect.objectContaining({
        merchant: { id: merchantId, name: 'Amihan Goods', code: 'AMIHAN' },
        financeStatus: 'AGREEMENT_REQUIRED',
        periodStart: null,
        nextSettlementDeadline: null,
        grossSales: '0.00',
        amountDue: '0.00',
        branches: [{ id: 'branch-id', name: 'Main Branch' }],
      }),
    ]);
    expect(prisma.merchant.findMany).toHaveBeenCalledTimes(1);
  });

  it('generates a server-authoritative draft with agreement segments and prorated rent', async () => {
    await expect(
      service.generateDraft(
        organizationId,
        merchantId,
        actorId,
        '2026-07-01',
        '2026-07-31',
      ),
    ).resolves.toMatchObject({
      id: settlementId,
      grossSales: '3000.00',
      netPayout: '-1900.00',
    });

    expect(transaction.organizationMembership.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: { organizationId, userId: actorId },
      },
      select: { role: true },
    });
    expect(transaction.merchant.findFirst).toHaveBeenCalledWith({
      where: { id: merchantId, organizationId },
      select: { id: true },
    });
    expect(transaction.saleItem.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
        merchantId,
        settlementLinks: { none: {} },
        sale: {
          completedAt: {
            gte: new Date('2026-06-30T16:00:00.000Z'),
            lt: new Date('2026-07-31T16:00:00.000Z'),
          },
        },
      },
      select: {
        id: true,
        total: true,
        sale: {
          select: {
            completedAt: true,
            branch: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ sale: { completedAt: 'asc' } }, { id: 'asc' }],
    });

    if (!capturedSettlementCreate) {
      throw new Error('Expected settlement create input');
    }
    const createInput = capturedSettlementCreate;
    expect(createInput.data).toMatchObject({
      organizationId,
      merchantId,
      periodStart: new Date('2026-07-01T00:00:00.000Z'),
      periodEnd: new Date('2026-07-31T00:00:00.000Z'),
      schedule: SettlementSchedule.MONTHLY,
      calculatedById: actorId,
    });
    expect(createInput.data.grossSales.toFixed(2)).toBe('3000.00');
    expect(createInput.data.commissionAmount.toFixed(2)).toBe('200.00');
    expect(createInput.data.fixedRentAmount.toFixed(2)).toBe('6200.00');
    expect(createInput.data.netPayout.toFixed(2)).toBe('-3400.00');
    expect(createInput.data.terms.create).toHaveLength(2);
    expect(
      createInput.data.terms.create.map(
        (term: { fixedRentAmount: Prisma.Decimal }) =>
          term.fixedRentAmount.toFixed(2),
      ),
    ).toEqual(['0.00', '6200.00']);
    if (!capturedSaleItemCreateMany) {
      throw new Error('Expected settlement sale-item input');
    }
    const saleLinkInput = capturedSaleItemCreateMany;
    expect(saleLinkInput.data).toHaveLength(2);
    expect(saleLinkInput.data[0]).toMatchObject({
      saleItemId: saleItems[0].id,
      grossAmount: saleItems[0].total,
      organizationId,
      merchantId,
    });
    expect(saleLinkInput.data[1]).toMatchObject({
      saleItemId: saleItems[1].id,
      grossAmount: saleItems[1].total,
      organizationId,
      merchantId,
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('subtracts refunds before calculating segment commission', async () => {
    transaction.saleRefundItem.findMany.mockResolvedValue([
      {
        id: '55555555-5555-4555-8555-555555555555',
        amount: new Prisma.Decimal('200.00'),
        refund: { completedAt: new Date('2026-07-20T05:00:00.000Z') },
      },
    ]);

    await service.generateDraft(
      organizationId,
      merchantId,
      actorId,
      '2026-07-01',
      '2026-07-31',
    );

    expect(capturedSettlementCreate?.data).toEqual(
      expect.objectContaining({
        grossSales: new Prisma.Decimal('3000.00'),
        refundTotal: new Prisma.Decimal('200.00'),
        netSales: new Prisma.Decimal('2800.00'),
        commissionAmount: new Prisma.Decimal('190.00'),
        netPayout: new Prisma.Decimal('-3590.00'),
      }),
    );
    expect(transaction.settlementRefundItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          refundItemId: '55555555-5555-4555-8555-555555555555',
          refundAmount: new Prisma.Decimal('200.00'),
        }),
      ],
    });
  });

  it('re-checks the actor role inside the finance transaction', async () => {
    transaction.organizationMembership.findUnique.mockResolvedValue({
      role: OrganizationRole.CASHIER,
    });

    await expect(
      service.generateDraft(
        organizationId,
        merchantId,
        actorId,
        '2026-07-01',
        '2026-07-31',
      ),
    ).rejects.toThrow(
      new ForbiddenException(
        'Your organization role cannot manage settlements',
      ),
    );
    expect(transaction.merchant.findFirst).not.toHaveBeenCalled();
  });

  it('conceals a merchant outside the trusted organization', async () => {
    transaction.merchant.findFirst.mockResolvedValue(null);

    await expect(
      service.generateDraft(
        organizationId,
        merchantId,
        actorId,
        '2026-07-01',
        '2026-07-31',
      ),
    ).rejects.toThrow(new NotFoundException('Merchant not found'));
  });

  it('requires a complete closed period matching the agreement schedule', async () => {
    await expect(
      service.generateDraft(
        organizationId,
        merchantId,
        actorId,
        '2026-07-01',
        '2026-07-15',
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Settlement dates must match the merchant agreement schedule',
      ),
    );
  });

  it('rejects sales that fall into an agreement coverage gap', async () => {
    transaction.merchantAgreement.findMany.mockResolvedValue([
      { ...agreements[0], endDate: new Date('2026-07-09T00:00:00.000Z') },
      agreements[1],
    ]);

    await expect(
      service.generateDraft(
        organizationId,
        merchantId,
        actorId,
        '2026-07-01',
        '2026-07-31',
      ),
    ).rejects.toThrow(
      new ConflictException(
        'One or more merchant sales are not covered by an effective agreement',
      ),
    );
    expect(transaction.merchantSettlement.create).not.toHaveBeenCalled();
  });

  it.each(['P2002', 'P2004', 'P2034'])(
    'maps Prisma %s finance conflicts to a retryable response',
    async (code) => {
      prisma.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique conflict', {
          code,
          clientVersion: '7.9.1',
        }),
      );

      await expect(
        service.generateDraft(
          organizationId,
          merchantId,
          actorId,
          '2026-07-01',
          '2026-07-31',
        ),
      ).rejects.toThrow(
        new ConflictException(
          'Settlement generation conflicted with another finance operation; retry the request',
        ),
      );
    },
  );

  it('lists only tenant-scoped settlements and maps monetary values', async () => {
    const row = {
      id: settlementId,
      organizationId,
      merchantId,
      periodStart: new Date('2026-07-01T00:00:00.000Z'),
      periodEnd: new Date('2026-07-31T00:00:00.000Z'),
      schedule: SettlementSchedule.MONTHLY,
      status: SettlementStatus.DRAFT,
      grossSales: new Prisma.Decimal('3000.00'),
      refundTotal: new Prisma.Decimal('0.00'),
      netSales: new Prisma.Decimal('3000.00'),
      commissionAmount: new Prisma.Decimal('200.00'),
      fixedRentAmount: new Prisma.Decimal('4700.00'),
      rentAccruedAmount: new Prisma.Decimal('4700.00'),
      adjustmentTotal: new Prisma.Decimal('0.00'),
      netPayout: new Prisma.Decimal('-1900.00'),
      calculatedById: actorId,
      calculatedAt: createdAt,
      reviewedById: null,
      reviewedAt: null,
      approvedById: null,
      approvedAt: null,
      createdAt,
      updatedAt: createdAt,
      merchant: { id: merchantId, name: 'Amihan Goods', code: 'AMH' },
      saleItems: [],
      refundItems: [],
    };
    prisma.merchantSettlement.findMany.mockResolvedValue([row]);
    prisma.merchantSettlement.count.mockResolvedValue(1);
    const {
      saleItems: _saleItems,
      refundItems: _refundItems,
      ...summaryRow
    } = row;
    void _saleItems;
    void _refundItems;

    await expect(
      service.findAll(organizationId, {
        merchantId,
        status: SettlementStatus.DRAFT,
        periodFrom: '2026-01-01',
        periodTo: '2026-07-31',
        offset: 0,
        limit: 30,
      }),
    ).resolves.toEqual({
      items: [
        {
          ...summaryRow,
          grossSales: '3000.00',
          refundTotal: '0.00',
          netSales: '3000.00',
          commissionAmount: '200.00',
          fixedRentAmount: '4700.00',
          rentAccruedAmount: '4700.00',
          adjustmentTotal: '0.00',
          netPayout: '-1900.00',
          branches: [],
        },
      ],
      total: 1,
      offset: 0,
      limit: 30,
    });
    expect(prisma.merchantSettlement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId,
          merchantId,
          status: SettlementStatus.DRAFT,
          periodStart: { gte: new Date('2026-01-01T00:00:00.000Z') },
          periodEnd: { lte: new Date('2026-07-31T00:00:00.000Z') },
        },
        skip: 0,
        take: 30,
      }),
    );
  });

  it('aggregates exact filtered overview metrics across all settlements', async () => {
    prisma.merchantSettlement.aggregate.mockResolvedValue({
      _sum: {
        grossSales: new Prisma.Decimal('10000.00'),
        refundTotal: new Prisma.Decimal('500.00'),
        netSales: new Prisma.Decimal('9500.00'),
        commissionAmount: new Prisma.Decimal('950.00'),
        fixedRentAmount: new Prisma.Decimal('2000.00'),
        adjustmentTotal: new Prisma.Decimal('-100.00'),
        netPayout: new Prisma.Decimal('6450.00'),
      },
      _count: 3,
    });

    await expect(
      service.summary(organizationId, {
        branchId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        offset: 0,
        limit: 30,
      }),
    ).resolves.toEqual({
      grossSales: '10000.00',
      refunds: '500.00',
      netSales: '9500.00',
      deductions: '3050.00',
      amountDue: '6450.00',
      count: 3,
    });
    // Jest asymmetric matchers are intentionally untyped at this boundary.
    expect(prisma.merchantSettlement.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          organizationId,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('rejects reversed list boundaries before querying finance records', async () => {
    await expect(
      service.findAll(organizationId, {
        periodFrom: '2026-08-01',
        periodTo: '2026-07-31',
        offset: 0,
        limit: 30,
      }),
    ).rejects.toThrow(
      new BadRequestException('periodFrom must be before or equal to periodTo'),
    );
    expect(prisma.merchantSettlement.findMany).not.toHaveBeenCalled();
  });

  it('conceals missing or cross-tenant settlement details', async () => {
    prisma.merchantSettlement.findFirst.mockResolvedValue(null);

    await expect(service.findOne(organizationId, settlementId)).rejects.toThrow(
      new NotFoundException('Settlement not found'),
    );
    expect(prisma.merchantSettlement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: settlementId, organizationId },
      }),
    );
  });

  it('allows only an owner to approve and lock a draft settlement', async () => {
    transaction.organizationMembership.findUnique.mockResolvedValue({
      role: OrganizationRole.OWNER,
    });

    await service.approve(organizationId, settlementId, actorId);

    expect(transaction.merchantSettlement.updateMany).toHaveBeenCalledWith({
      where: {
        id: settlementId,
        organizationId,
        status: { in: [SettlementStatus.DRAFT, SettlementStatus.REVIEWED] },
      },
      // Jest asymmetric matchers are intentionally untyped at this boundary.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        status: SettlementStatus.APPROVED,
        approvedById: actorId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        approvedAt: expect.any(Date),
      }),
    });
  });

  it('rechecks the owner role inside approval transactions', async () => {
    transaction.organizationMembership.findUnique.mockResolvedValue({
      role: OrganizationRole.MANAGER,
    });

    await expect(
      service.approve(organizationId, settlementId, actorId),
    ).rejects.toThrow(
      new ForbiddenException(
        'Your organization role cannot manage settlements',
      ),
    );
    expect(transaction.merchantSettlement.updateMany).not.toHaveBeenCalled();
  });

  it('rejects skipped or stale lifecycle transitions', async () => {
    transaction.organizationMembership.findUnique.mockResolvedValue({
      role: OrganizationRole.OWNER,
    });

    transaction.merchantSettlement.updateMany.mockResolvedValueOnce({
      count: 0,
    });
    await expect(
      service.approve(organizationId, settlementId, actorId),
    ).rejects.toThrow(
      new ConflictException('Only a draft settlement can be approved'),
    );
    expect(transaction.merchantSettlement.updateMany).toHaveBeenCalled();
  });

  it('records the exact approved net payout and atomically marks it paid', async () => {
    transaction.organizationMembership.findUnique.mockResolvedValue({
      role: OrganizationRole.OWNER,
    });
    transaction.merchantSettlement.findFirst.mockResolvedValue({
      status: SettlementStatus.APPROVED,
      merchantId,
      netPayout: new Prisma.Decimal('42000.50'),
    });

    await service.recordPayout(organizationId, settlementId, actorId, {
      method: PayoutMethod.GCASH,
      referenceNumber: 'GCASH-123',
      note: 'August payout',
      paidAt: '2020-08-30T04:00:00.000Z',
    });

    expect(transaction.merchantSettlement.updateMany).toHaveBeenCalledWith({
      where: {
        id: settlementId,
        organizationId,
        status: SettlementStatus.APPROVED,
      },
      data: { status: SettlementStatus.PAID },
    });
    expect(transaction.merchantPayout.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        merchantId,
        settlementId,
        amount: new Prisma.Decimal('42000.50'),
        method: PayoutMethod.GCASH,
        referenceNumber: 'GCASH-123',
        note: 'August payout',
        paidAt: new Date('2020-08-30T04:00:00.000Z'),
        recordedById: actorId,
      },
    });
  });

  it('rechecks owner authority and rejects non-positive payouts', async () => {
    transaction.organizationMembership.findUnique.mockResolvedValue({
      role: OrganizationRole.MANAGER,
    });

    await expect(
      service.recordPayout(organizationId, settlementId, actorId, {
        method: PayoutMethod.CASH,
        paidAt: '2020-08-30T04:00:00.000Z',
      }),
    ).rejects.toThrow(ForbiddenException);

    transaction.organizationMembership.findUnique.mockResolvedValue({
      role: OrganizationRole.OWNER,
    });
    transaction.merchantSettlement.findFirst.mockResolvedValue({
      status: SettlementStatus.APPROVED,
      merchantId,
      netPayout: new Prisma.Decimal('0.00'),
    });
    await expect(
      service.recordPayout(organizationId, settlementId, actorId, {
        method: PayoutMethod.CASH,
        paidAt: '2020-08-30T04:00:00.000Z',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Only settlements with a positive net payout can be paid',
      ),
    );
    expect(transaction.merchantPayout.create).not.toHaveBeenCalled();
  });

  it('rejects stale, cross-tenant, and future payout attempts', async () => {
    transaction.organizationMembership.findUnique.mockResolvedValue({
      role: OrganizationRole.OWNER,
    });
    transaction.merchantSettlement.findFirst.mockResolvedValue({
      status: SettlementStatus.REVIEWED,
      merchantId,
      netPayout: new Prisma.Decimal('100.00'),
    });
    await expect(
      service.recordPayout(organizationId, settlementId, actorId, {
        method: PayoutMethod.CASH,
        paidAt: '2020-08-30T04:00:00.000Z',
      }),
    ).rejects.toThrow(
      new ConflictException(
        'Settlement must be approved before it can be paid',
      ),
    );

    transaction.merchantSettlement.findFirst.mockResolvedValue(null);
    await expect(
      service.recordPayout(organizationId, settlementId, actorId, {
        method: PayoutMethod.CASH,
        paidAt: '2020-08-30T04:00:00.000Z',
      }),
    ).rejects.toThrow(new NotFoundException('Settlement not found'));

    await expect(
      service.recordPayout(organizationId, settlementId, actorId, {
        method: PayoutMethod.CASH,
        paidAt: '2999-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(
      new BadRequestException('Payout date cannot be in the future'),
    );
  });
});
