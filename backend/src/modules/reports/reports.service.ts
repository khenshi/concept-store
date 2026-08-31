import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SettlementStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ReportFiltersDto } from './dto/report-filters.dto';
import type { ReportsOverviewRecord } from './reports.types';

const LOW_STOCK_MAXIMUM = 5;
const DAY_MS = 86_400_000;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(
    organizationId: string,
    filters: ReportFiltersDto,
  ): Promise<ReportsOverviewRecord> {
    const period = this.resolvePeriod(filters.from, filters.to);
    await this.validateFilters(organizationId, filters);

    const saleItemWhere: Prisma.SaleItemWhereInput = {
      organizationId,
      merchantId: filters.merchantId,
      sale: {
        branchId: filters.branchId,
        completedAt: { gte: period.start, lt: period.endExclusive },
      },
    };
    const refundWhere: Prisma.SaleRefundItemWhereInput = {
      organizationId,
      merchantId: filters.merchantId,
      refund: {
        branchId: filters.branchId,
        completedAt: { gte: period.start, lt: period.endExclusive },
      },
    };
    const settlementActivity = filters.branchId
      ? {
          OR: [
            {
              saleItems: {
                some: { saleItem: { sale: { branchId: filters.branchId } } },
              },
            },
            {
              refundItems: {
                some: {
                  refundItem: { refund: { branchId: filters.branchId } },
                },
              },
            },
          ],
        }
      : {};
    const settlementWhere: Prisma.MerchantSettlementWhereInput = {
      organizationId,
      merchantId: filters.merchantId,
      periodEnd: { gte: period.dateStart, lte: period.dateEnd },
      ...settlementActivity,
    };
    const inventoryWhere: Prisma.InventoryWhereInput = {
      organizationId,
      branchId: filters.branchId,
      product: { merchantId: filters.merchantId },
    };
    const saleWhere: Prisma.SaleWhereInput = {
      organizationId,
      branchId: filters.branchId,
      completedAt: { gte: period.start, lt: period.endExclusive },
      items: filters.merchantId
        ? { some: { merchantId: filters.merchantId } }
        : undefined,
    };

    const [
      gross,
      refunds,
      saleCount,
      finalizedRevenue,
      outstanding,
      paidSettlements,
      inventory,
      stockRecordCount,
      lowStockCount,
      recentSales,
      recentSettlements,
    ] = await Promise.all([
      this.prisma.saleItem.aggregate({
        where: saleItemWhere,
        _sum: { total: true },
      }),
      this.prisma.saleRefundItem.aggregate({
        where: refundWhere,
        _sum: { amount: true },
      }),
      this.prisma.sale.count({ where: saleWhere }),
      this.prisma.merchantSettlement.aggregate({
        where: {
          ...settlementWhere,
          status: { in: [SettlementStatus.APPROVED, SettlementStatus.PAID] },
        },
        _sum: {
          commissionAmount: true,
          fixedRentAmount: true,
          adjustmentTotal: true,
        },
      }),
      this.prisma.merchantSettlement.aggregate({
        where: { ...settlementWhere, status: SettlementStatus.APPROVED },
        _sum: { netPayout: true },
        _count: { _all: true },
      }),
      this.prisma.merchantSettlement.aggregate({
        where: { ...settlementWhere, status: SettlementStatus.PAID },
        _sum: { netPayout: true },
        _count: { _all: true },
      }),
      this.prisma.inventory.aggregate({
        where: inventoryWhere,
        _sum: { quantity: true },
      }),
      this.prisma.inventory.count({ where: inventoryWhere }),
      this.prisma.inventory.count({
        where: { ...inventoryWhere, quantity: { lte: LOW_STOCK_MAXIMUM } },
      }),
      this.prisma.sale.findMany({
        where: saleWhere,
        select: {
          id: true,
          saleNumber: true,
          total: true,
          completedAt: true,
          branch: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
      this.prisma.merchantSettlement.findMany({
        where: settlementWhere,
        select: {
          id: true,
          merchantId: true,
          periodStart: true,
          periodEnd: true,
          status: true,
          netPayout: true,
          merchant: { select: { name: true } },
        },
        orderBy: [{ periodEnd: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
    ]);

    const grossSales = gross._sum.total ?? new Prisma.Decimal(0);
    const refundTotal = refunds._sum.amount ?? new Prisma.Decimal(0);
    const commission =
      finalizedRevenue._sum.commissionAmount ?? new Prisma.Decimal(0);
    const fixedRent =
      finalizedRevenue._sum.fixedRentAmount ?? new Prisma.Decimal(0);
    const adjustments =
      finalizedRevenue._sum.adjustmentTotal ?? new Prisma.Decimal(0);

    return {
      period: { from: period.from, to: period.to },
      filters: {
        branchId: filters.branchId ?? null,
        merchantId: filters.merchantId ?? null,
      },
      sales: {
        grossSales: grossSales.toFixed(2),
        refunds: refundTotal.toFixed(2),
        netSales: grossSales.sub(refundTotal).toFixed(2),
        saleCount,
      },
      revenue: {
        commission: commission.toFixed(2),
        fixedRent: fixedRent.toFixed(2),
        adjustments: adjustments.toFixed(2),
        total: commission.add(fixedRent).sub(adjustments).toFixed(2),
      },
      settlements: {
        outstandingAmount: (
          outstanding._sum.netPayout ?? new Prisma.Decimal(0)
        ).toFixed(2),
        outstandingCount: outstanding._count._all,
        paidAmount: (
          paidSettlements._sum.netPayout ?? new Prisma.Decimal(0)
        ).toFixed(2),
        paidCount: paidSettlements._count._all,
      },
      inventory: {
        quantityOnHand: inventory._sum.quantity ?? 0,
        stockRecordCount,
        lowStockCount,
      },
      recentSales: recentSales.map((sale) => ({
        ...sale,
        total: sale.total.toFixed(2),
      })),
      recentSettlements: recentSettlements.map((settlement) => ({
        id: settlement.id,
        merchantId: settlement.merchantId,
        merchantName: settlement.merchant.name,
        periodStart: settlement.periodStart,
        periodEnd: settlement.periodEnd,
        status: settlement.status,
        netPayout: settlement.netPayout.toFixed(2),
      })),
    };
  }

  private resolvePeriod(from?: string, to?: string) {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const resolvedTo = to ?? today;
    const toDate = new Date(`${resolvedTo}T00:00:00.000Z`);
    const resolvedFrom =
      from ??
      new Date(toDate.getTime() - 29 * DAY_MS).toISOString().slice(0, 10);
    if (resolvedFrom > resolvedTo) {
      throw new BadRequestException('from must be on or before to');
    }
    const dateStart = new Date(`${resolvedFrom}T00:00:00.000Z`);
    const dateEnd = new Date(`${resolvedTo}T00:00:00.000Z`);
    return {
      from: resolvedFrom,
      to: resolvedTo,
      dateStart,
      dateEnd,
      start: new Date(`${resolvedFrom}T00:00:00+08:00`),
      endExclusive: new Date(dateEnd.getTime() + DAY_MS - 8 * 60 * 60 * 1000),
    };
  }

  private async validateFilters(
    organizationId: string,
    filters: ReportFiltersDto,
  ): Promise<void> {
    const [branch, merchant] = await Promise.all([
      filters.branchId
        ? this.prisma.branch.findFirst({
            where: { id: filters.branchId, organizationId },
            select: { id: true },
          })
        : null,
      filters.merchantId
        ? this.prisma.merchant.findFirst({
            where: { id: filters.merchantId, organizationId },
            select: { id: true },
          })
        : null,
    ]);
    if (filters.branchId && !branch)
      throw new NotFoundException('Branch not found');
    if (filters.merchantId && !merchant)
      throw new NotFoundException('Merchant not found');
  }
}
