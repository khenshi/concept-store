import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const organizationId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const branchId = '6b109a2f-142c-4af4-93d8-12941d0685ac';
  const merchantId = '2f671678-91d3-4d04-a8f9-787a2e9f3c1a';
  const userId = '160872ff-c20b-4cee-a58c-06a5d4431509';
  const prisma = {
    branch: { findFirst: jest.fn() },
    merchant: { findFirst: jest.fn() },
    saleItem: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    saleRefundItem: { aggregate: jest.fn() },
    sale: { count: jest.fn(), findMany: jest.fn() },
    merchantSettlement: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    merchantPayout: { groupBy: jest.fn() },
    merchantAccount: { findUnique: jest.fn() },
    inventory: { aggregate: jest.fn(), count: jest.fn(), findMany: jest.fn() },
  };
  let service: ReportsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ReportsService);
  });

  it('returns decimal-safe tenant-scoped overview metrics', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: branchId });
    prisma.merchant.findFirst.mockResolvedValue({ id: merchantId });
    prisma.saleItem.aggregate.mockResolvedValue({
      _sum: { total: new Prisma.Decimal('1000.00') },
    });
    prisma.saleRefundItem.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal('100.00') },
    });
    prisma.sale.count.mockResolvedValue(4);
    prisma.merchantSettlement.aggregate
      .mockResolvedValueOnce({
        _sum: {
          commissionAmount: new Prisma.Decimal('90.00'),
          fixedRentAmount: new Prisma.Decimal('50.00'),
          adjustmentTotal: new Prisma.Decimal('10.00'),
        },
      })
      .mockResolvedValueOnce({
        _sum: { netPayout: new Prisma.Decimal('300.00') },
        _count: { _all: 1 },
      })
      .mockResolvedValueOnce({
        _sum: { netPayout: new Prisma.Decimal('460.00') },
        _count: { _all: 2 },
      });
    prisma.inventory.aggregate.mockResolvedValue({ _sum: { quantity: 18 } });
    prisma.inventory.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    prisma.sale.findMany.mockResolvedValue([]);
    prisma.merchantSettlement.findMany.mockResolvedValue([]);

    await expect(
      service.overview(organizationId, {
        from: '2026-08-01',
        to: '2026-08-31',
        branchId,
        merchantId,
      }),
    ).resolves.toMatchObject({
      period: { from: '2026-08-01', to: '2026-08-31' },
      sales: {
        grossSales: '1000.00',
        refunds: '100.00',
        netSales: '900.00',
        saleCount: 4,
      },
      revenue: {
        commission: '90.00',
        fixedRent: '50.00',
        adjustments: '10.00',
        total: '130.00',
      },
      settlements: {
        outstandingAmount: '300.00',
        outstandingCount: 1,
        paidAmount: '460.00',
        paidCount: 2,
      },
      inventory: {
        quantityOnHand: 18,
        stockRecordCount: 3,
        lowStockCount: 1,
      },
    });

    expect(prisma.saleItem.aggregate).toHaveBeenCalled();
    expect(prisma.merchantSettlement.aggregate).toHaveBeenCalledTimes(3);
  });

  it('rejects reversed periods before querying report data', async () => {
    await expect(
      service.overview(organizationId, {
        from: '2026-09-01',
        to: '2026-08-01',
      }),
    ).rejects.toThrow(new BadRequestException('from must be on or before to'));
    expect(prisma.saleItem.aggregate).not.toHaveBeenCalled();
  });

  it('does not accept a branch outside the tenant', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);

    await expect(
      service.overview(organizationId, {
        from: '2026-08-01',
        to: '2026-08-31',
        branchId,
      }),
    ).rejects.toThrow(new NotFoundException('Branch not found'));
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: { id: branchId, organizationId },
      select: { id: true },
    });
    expect(prisma.saleItem.aggregate).not.toHaveBeenCalled();
  });

  it('returns paginated merchant-attributed sale rows with refunds', async () => {
    const completedAt = new Date('2026-08-15T04:00:00.000Z');
    prisma.saleItem.findMany.mockResolvedValue([
      {
        id: 'sale-item-id',
        saleId: 'sale-id',
        productName: 'Woven pouch',
        productSku: 'POUCH-1',
        quantity: 2,
        total: new Prisma.Decimal('500.00'),
        merchant: { id: merchantId, name: 'Merchant A' },
        sale: {
          saleNumber: 'S-001',
          completedAt,
          branch: { id: branchId, name: 'Main', code: 'MAIN' },
        },
        refundItems: [{ amount: new Prisma.Decimal('250.00') }],
      },
    ]);
    prisma.saleItem.count.mockResolvedValue(1);

    await expect(
      service.sales(organizationId, {
        from: '2026-08-01',
        to: '2026-08-31',
        offset: 0,
        limit: 30,
      }),
    ).resolves.toMatchObject({
      items: [
        {
          saleNumber: 'S-001',
          grossSales: '500.00',
          refunds: '250.00',
          netSales: '250.00',
        },
      ],
      total: 1,
      offset: 0,
      limit: 30,
    });
  });

  it('rejects an unlinked merchant dashboard account', async () => {
    prisma.merchantAccount.findUnique.mockResolvedValue(null);

    await expect(
      service.merchantDashboard(organizationId, userId, {}),
    ).rejects.toThrow(new NotFoundException('Merchant account is not linked'));
  });
});
