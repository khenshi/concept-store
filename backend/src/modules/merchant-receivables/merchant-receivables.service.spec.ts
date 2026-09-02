import { NotFoundException } from '@nestjs/common';
import {
  MerchantReceivableStatus,
  MerchantReceivableType,
  Prisma,
} from '../../generated/prisma/client';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { MerchantReceivablesService } from './merchant-receivables.service';
import { merchantReceivableInclude } from './merchant-receivables.types';

describe('MerchantReceivablesService', () => {
  const prisma = {
    merchantAgreement: { findMany: jest.fn() },
    merchantReceivable: {
      createMany: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
  };
  const service = new MerchantReceivablesService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates one current fixed-rent receivable and returns tenant-scoped rows', async () => {
    prisma.merchantAgreement.findMany.mockResolvedValue([
      {
        id: 'agreement-1',
        merchantId: 'merchant-1',
        fixedRentAmount: new Prisma.Decimal('2500.00'),
      },
    ]);
    prisma.merchantReceivable.createMany.mockResolvedValue({ count: 1 });
    prisma.merchantReceivable.updateMany.mockResolvedValue({ count: 0 });
    const row = {
      id: 'receivable-1',
      organizationId: 'organization-1',
      merchantId: 'merchant-1',
      agreementId: 'agreement-1',
      type: MerchantReceivableType.RENT,
      sourcePeriod: new Date('2026-09-01T00:00:00.000Z'),
      originalAmount: new Prisma.Decimal('2500.00'),
      remainingAmount: new Prisma.Decimal('2500.00'),
      dueDate: new Date('2026-09-30T00:00:00.000Z'),
      status: MerchantReceivableStatus.OPEN,
      createdAt: new Date(),
      updatedAt: new Date(),
      merchant: { id: 'merchant-1', name: 'Merchant', code: null },
      agreement: {
        id: 'agreement-1',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: null,
        fixedRentAmount: new Prisma.Decimal('2500.00'),
      },
      transactions: [],
    };
    prisma.merchantReceivable.findMany.mockResolvedValue([row]);
    prisma.merchantReceivable.count.mockResolvedValue(1);

    const result = await service.findAll('organization-1', {
      merchantId: 'merchant-1',
      offset: 0,
      limit: 30,
    });

    expect(prisma.merchantReceivable.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: [
          expect.objectContaining({
            organizationId: 'organization-1',
            merchantId: 'merchant-1',
            type: MerchantReceivableType.RENT,
            originalAmount: new Prisma.Decimal('2500.00'),
          }),
        ],
      }),
    );
    expect(prisma.merchantReceivable.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'organization-1',
        merchantId: 'merchant-1',
        status: undefined,
      },
      include: merchantReceivableInclude,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      skip: 0,
      take: 30,
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'receivable-1',
        originalAmount: '2500.00',
        remainingAmount: '2500.00',
      }),
    );
  });

  it('does not create rent when no active fixed-rent agreement exists', async () => {
    prisma.merchantAgreement.findMany.mockResolvedValue([]);

    await service.ensureCurrentRentReceivables('organization-1');

    expect(prisma.merchantReceivable.createMany).not.toHaveBeenCalled();
  });

  it('does not return a receivable from another tenant', async () => {
    prisma.merchantReceivable.updateMany.mockResolvedValue({ count: 0 });
    prisma.merchantReceivable.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('organization-1', 'receivable-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.merchantReceivable.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'receivable-1', organizationId: 'organization-1' },
      }),
    );
  });
});
