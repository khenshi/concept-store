import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SettlementStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ReportFiltersDto } from './dto/report-filters.dto';
import type { ReportPageFiltersDto } from './dto/report-page-filters.dto';
import type {
  InventoryReportRecord,
  MerchantDashboardRecord,
  MerchantReportRecord,
  ReportsOverviewRecord,
  SalesReportRecord,
} from './reports.types';

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

  async merchantDashboard(
    organizationId: string,
    userId: string,
    filters: Pick<ReportFiltersDto, 'from' | 'to'>,
  ): Promise<MerchantDashboardRecord> {
    const account = await this.prisma.merchantAccount.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { merchant: { select: { id: true, name: true } } },
    });
    if (!account) {
      throw new NotFoundException('Merchant account is not linked');
    }
    const overview = await this.overview(organizationId, {
      ...filters,
      merchantId: account.merchant.id,
    });
    return {
      merchant: account.merchant,
      period: overview.period,
      sales: overview.sales,
      settlements: overview.settlements,
      inventory: overview.inventory,
      recentSettlements: overview.recentSettlements,
    };
  }

  async sales(
    organizationId: string,
    filters: ReportPageFiltersDto,
  ): Promise<SalesReportRecord> {
    const period = this.resolvePeriod(filters.from, filters.to);
    await this.validateFilters(organizationId, filters);
    const where: Prisma.SaleItemWhereInput = {
      organizationId,
      merchantId: filters.merchantId,
      sale: {
        branchId: filters.branchId,
        completedAt: { gte: period.start, lt: period.endExclusive },
      },
    };
    const [rows, total] = await Promise.all([
      this.prisma.saleItem.findMany({
        where,
        select: {
          id: true,
          saleId: true,
          productName: true,
          productSku: true,
          quantity: true,
          total: true,
          merchant: { select: { id: true, name: true } },
          sale: {
            select: {
              saleNumber: true,
              completedAt: true,
              branch: { select: { id: true, name: true, code: true } },
            },
          },
          refundItems: {
            where: {
              refund: {
                completedAt: { gte: period.start, lt: period.endExclusive },
              },
            },
            select: { amount: true },
          },
        },
        orderBy: [{ sale: { completedAt: 'desc' } }, { id: 'desc' }],
        skip: filters.offset,
        take: filters.limit,
      }),
      this.prisma.saleItem.count({ where }),
    ]);
    return {
      items: rows.map((row) => {
        const refundTotal = row.refundItems.reduce(
          (sum, refund) => sum.add(refund.amount),
          new Prisma.Decimal(0),
        );
        return {
          id: row.id,
          saleId: row.saleId,
          saleNumber: row.sale.saleNumber,
          completedAt: row.sale.completedAt,
          branch: row.sale.branch,
          merchant: row.merchant,
          productName: row.productName,
          productSku: row.productSku,
          quantity: row.quantity,
          grossSales: row.total.toFixed(2),
          refunds: refundTotal.toFixed(2),
          netSales: row.total.sub(refundTotal).toFixed(2),
        };
      }),
      total,
      offset: filters.offset,
      limit: filters.limit,
    };
  }

  async inventory(
    organizationId: string,
    filters: ReportPageFiltersDto,
  ): Promise<InventoryReportRecord> {
    await this.validateFilters(organizationId, filters);
    const where: Prisma.InventoryWhereInput = {
      organizationId,
      branchId: filters.branchId,
      product: { merchantId: filters.merchantId },
    };
    const [rows, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        select: {
          organizationId: true,
          branchId: true,
          productId: true,
          quantity: true,
          branch: { select: { id: true, name: true, code: true } },
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              status: true,
              sellingPrice: true,
              merchant: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ quantity: 'asc' }, { product: { name: 'asc' } }],
        skip: filters.offset,
        take: filters.limit,
      }),
      this.prisma.inventory.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        ...row,
        product: {
          ...row.product,
          status: row.product.status,
          sellingPrice: row.product.sellingPrice.toFixed(2),
        },
      })),
      total,
      offset: filters.offset,
      limit: filters.limit,
    };
  }

  async merchants(
    organizationId: string,
    filters: ReportPageFiltersDto,
  ): Promise<MerchantReportRecord> {
    const period = this.resolvePeriod(filters.from, filters.to);
    await this.validateFilters(organizationId, filters);
    const merchantWhere: Prisma.MerchantWhereInput = {
      organizationId,
      id: filters.merchantId,
      branches: filters.branchId
        ? { some: { branchId: filters.branchId } }
        : undefined,
    };
    const [merchants, total] = await Promise.all([
      this.prisma.merchant.findMany({
        where: merchantWhere,
        select: { id: true, name: true, status: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: filters.offset,
        take: filters.limit,
      }),
      this.prisma.merchant.count({ where: merchantWhere }),
    ]);
    const merchantIds = merchants.map((merchant) => merchant.id);
    if (merchantIds.length === 0) {
      return { items: [], total, offset: filters.offset, limit: filters.limit };
    }
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
    const [sales, refunds, settlements, payouts] = await Promise.all([
      this.prisma.saleItem.groupBy({
        by: ['merchantId'],
        where: {
          organizationId,
          merchantId: { in: merchantIds },
          sale: {
            branchId: filters.branchId,
            completedAt: { gte: period.start, lt: period.endExclusive },
          },
        },
        _sum: { total: true },
      }),
      this.prisma.saleRefundItem.groupBy({
        by: ['merchantId'],
        where: {
          organizationId,
          merchantId: { in: merchantIds },
          refund: {
            branchId: filters.branchId,
            completedAt: { gte: period.start, lt: period.endExclusive },
          },
        },
        _sum: { amount: true },
      }),
      this.prisma.merchantSettlement.groupBy({
        by: ['merchantId'],
        where: {
          organizationId,
          merchantId: { in: merchantIds },
          periodEnd: { gte: period.dateStart, lte: period.dateEnd },
          status: { in: [SettlementStatus.APPROVED, SettlementStatus.PAID] },
          ...settlementActivity,
        },
        _sum: { commissionAmount: true, fixedRentAmount: true },
      }),
      this.prisma.merchantPayout.groupBy({
        by: ['merchantId'],
        where: {
          organizationId,
          merchantId: { in: merchantIds },
          paidAt: { gte: period.start, lt: period.endExclusive },
          settlement: settlementActivity,
        },
        _sum: { amount: true },
      }),
    ]);
    const saleByMerchant = new Map(
      sales.map((row) => [row.merchantId, row._sum.total]),
    );
    const refundByMerchant = new Map(
      refunds.map((row) => [row.merchantId, row._sum.amount]),
    );
    const settlementByMerchant = new Map(
      settlements.map((row) => [row.merchantId, row._sum]),
    );
    const payoutByMerchant = new Map(
      payouts.map((row) => [row.merchantId, row._sum.amount]),
    );

    return {
      items: merchants.map((merchant) => {
        const gross = saleByMerchant.get(merchant.id) ?? new Prisma.Decimal(0);
        const refund =
          refundByMerchant.get(merchant.id) ?? new Prisma.Decimal(0);
        const finalized = settlementByMerchant.get(merchant.id);
        return {
          ...merchant,
          status: merchant.status,
          grossSales: gross.toFixed(2),
          refunds: refund.toFixed(2),
          netSales: gross.sub(refund).toFixed(2),
          finalizedCommission: (
            finalized?.commissionAmount ?? new Prisma.Decimal(0)
          ).toFixed(2),
          finalizedRent: (
            finalized?.fixedRentAmount ?? new Prisma.Decimal(0)
          ).toFixed(2),
          amountPaid: (
            payoutByMerchant.get(merchant.id) ?? new Prisma.Decimal(0)
          ).toFixed(2),
        };
      }),
      total,
      offset: filters.offset,
      limit: filters.limit,
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
