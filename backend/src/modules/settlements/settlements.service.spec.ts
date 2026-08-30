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
  Prisma,
  SettlementSchedule,
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
    merchantSettlement: {
      create:
        jest.fn<(input: SettlementCreateArgument) => Promise<{ id: string }>>(),
      findUniqueOrThrow: jest.fn(),
    },
    settlementSaleItem: {
      createMany:
        jest.fn<
          (
            input: SettlementSaleItemCreateManyArgument,
          ) => Promise<{ count: number }>
        >(),
    },
  };
  const prisma = { $transaction: jest.fn() };
  let service: SettlementsService;
  let capturedSettlementCreate: SettlementCreateArgument | undefined;
  let capturedSaleItemCreateMany:
    SettlementSaleItemCreateManyArgument | undefined;

  beforeEach(async () => {
    jest.clearAllMocks();
    capturedSettlementCreate = undefined;
    capturedSaleItemCreateMany = undefined;
    prisma.$transaction.mockImplementation(
      (operation: (client: typeof transaction) => unknown) =>
        operation(transaction),
    );
    transaction.organizationMembership.findUnique.mockResolvedValue({
      role: OrganizationRole.MANAGER,
    });
    transaction.merchant.findFirst.mockResolvedValue({ id: merchantId });
    transaction.merchantAgreement.findMany.mockResolvedValue(agreements);
    transaction.saleItem.findMany.mockResolvedValue(saleItems);
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
    transaction.merchantSettlement.findUniqueOrThrow.mockResolvedValue({
      id: settlementId,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        SettlementsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(SettlementsService);
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
    ).resolves.toEqual({ id: settlementId });

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
        sale: { select: { completedAt: true } },
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
    expect(createInput.data.fixedRentAmount.toFixed(2)).toBe('4700.00');
    expect(createInput.data.netPayout.toFixed(2)).toBe('-1900.00');
    expect(createInput.data.terms.create).toHaveLength(2);
    expect(
      createInput.data.terms.create.map(
        (term: { fixedRentAmount: Prisma.Decimal }) =>
          term.fixedRentAmount.toFixed(2),
      ),
    ).toEqual(['1500.00', '3200.00']);
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
        'Your organization role cannot generate settlements',
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
});
