import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  MerchantFinanceAccrualService,
  type MerchantFinanceAccrualSnapshot,
} from './merchant-finance-accrual.service';

export interface FinanceAccrualReconciliationOptions {
  organizationId?: string;
  repair: boolean;
}

interface MoneyTotals {
  grossSales: string;
  refunds: string;
  commission: string;
  payable: string;
}

export interface MerchantFinanceAccrualReconciliationRow {
  organizationId: string;
  merchantId: string;
  merchantName: string;
  status: 'MATCH' | 'DRIFT' | 'BLOCKED';
  expected: MoneyTotals | null;
  projected: MoneyTotals;
  difference: MoneyTotals | null;
  differingBuckets: number;
  repaired: boolean;
  issues: string[];
}

export interface FinanceAccrualReconciliationReport {
  mode: 'REPORT' | 'REPAIR';
  organizationScope: string;
  organizationsChecked: number;
  merchantsChecked: number;
  matchingMerchants: number;
  driftedMerchants: number;
  blockedMerchants: number;
  repairedMerchants: number;
  rows: MerchantFinanceAccrualReconciliationRow[];
}

type StoredBucket = Awaited<
  ReturnType<Prisma.TransactionClient['merchantFinanceAccrual']['findMany']>
>[number];

@Injectable()
export class MerchantFinanceAccrualReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accruals: MerchantFinanceAccrualService,
  ) {}

  async run(
    options: FinanceAccrualReconciliationOptions,
  ): Promise<FinanceAccrualReconciliationReport> {
    const organizations = await this.prisma.organization.findMany({
      where: options.organizationId ? { id: options.organizationId } : {},
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    if (options.organizationId && organizations.length === 0) {
      throw new Error(`Organization ${options.organizationId} was not found`);
    }

    const rows: MerchantFinanceAccrualReconciliationRow[] = [];
    for (const organization of organizations) {
      const merchants = await this.prisma.merchant.findMany({
        where: { organizationId: organization.id },
        select: { id: true, name: true },
        orderBy: { id: 'asc' },
      });
      for (const merchant of merchants) {
        rows.push(
          await this.reconcileMerchant(
            organization.id,
            merchant.id,
            merchant.name,
            options.repair,
          ),
        );
      }
    }

    return {
      mode: options.repair ? 'REPAIR' : 'REPORT',
      organizationScope: options.organizationId ?? 'ALL',
      organizationsChecked: organizations.length,
      merchantsChecked: rows.length,
      matchingMerchants: rows.filter(({ status }) => status === 'MATCH').length,
      driftedMerchants: rows.filter(({ status }) => status === 'DRIFT').length,
      blockedMerchants: rows.filter(({ status }) => status === 'BLOCKED')
        .length,
      repairedMerchants: rows.filter(({ repaired }) => repaired).length,
      rows,
    };
  }

  private reconcileMerchant(
    organizationId: string,
    merchantId: string,
    merchantName: string,
    repair: boolean,
  ): Promise<MerchantFinanceAccrualReconciliationRow> {
    return this.prisma.$transaction(
      async (transaction) => {
        const projected = await transaction.merchantFinanceAccrual.findMany({
          where: { organizationId, merchantId },
          orderBy: [
            { periodStart: 'asc' },
            { agreementId: 'asc' },
            { kind: 'asc' },
          ],
        });
        let expected: MerchantFinanceAccrualSnapshot[];
        try {
          expected = await this.accruals.calculateMerchantProjection(
            transaction,
            organizationId,
            merchantId,
          );
        } catch (error: unknown) {
          return {
            organizationId,
            merchantId,
            merchantName,
            status: 'BLOCKED',
            expected: null,
            projected: this.totals(projected),
            difference: null,
            differingBuckets: 0,
            repaired: false,
            issues: [
              error instanceof Error
                ? error.message
                : 'Historical activity could not be attributed to an agreement',
            ],
          };
        }
        const differingBuckets = this.differingBucketCount(expected, projected);
        if (repair && differingBuckets > 0) {
          // Rebuild errors must escape the callback so the transaction rolls
          // back instead of committing a partially replaced projection.
          await this.accruals.rebuildMerchant(
            transaction,
            organizationId,
            merchantId,
          );
        }
        return {
          organizationId,
          merchantId,
          merchantName,
          status: differingBuckets === 0 ? 'MATCH' : 'DRIFT',
          expected: this.totals(expected),
          projected: this.totals(projected),
          difference: this.difference(expected, projected),
          differingBuckets,
          repaired: repair && differingBuckets > 0,
          issues: [],
        };
      },
      {
        isolationLevel: repair
          ? Prisma.TransactionIsolationLevel.Serializable
          : Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 30_000,
      },
    );
  }

  private differingBucketCount(
    expected: MerchantFinanceAccrualSnapshot[],
    projected: StoredBucket[],
  ): number {
    const expectedByKey = new Map(
      expected.map((bucket) => [this.key(bucket), this.values(bucket)]),
    );
    const projectedByKey = new Map(
      projected.map((bucket) => [this.key(bucket), this.values(bucket)]),
    );
    const keys = new Set([...expectedByKey.keys(), ...projectedByKey.keys()]);
    return [...keys].filter(
      (key) => expectedByKey.get(key) !== projectedByKey.get(key),
    ).length;
  }

  private key(bucket: {
    agreementId: string;
    periodStart: Date;
    periodEnd: Date;
    kind: string;
  }): string {
    return [
      bucket.agreementId,
      bucket.periodStart.toISOString(),
      bucket.periodEnd.toISOString(),
      bucket.kind,
    ].join(':');
  }

  private values(bucket: {
    schedule: string;
    commissionRate: Prisma.Decimal | null;
    grossSales: Prisma.Decimal;
    refundTotal: Prisma.Decimal;
    commissionAmount: Prisma.Decimal;
  }): string {
    return [
      bucket.schedule,
      bucket.commissionRate?.toFixed(2) ?? 'null',
      bucket.grossSales.toFixed(2),
      bucket.refundTotal.toFixed(2),
      bucket.commissionAmount.toFixed(2),
    ].join(':');
  }

  private totals(
    buckets: Array<{
      grossSales: Prisma.Decimal;
      refundTotal: Prisma.Decimal;
      commissionAmount: Prisma.Decimal;
    }>,
  ): MoneyTotals {
    const gross = this.sum(buckets.map(({ grossSales }) => grossSales));
    const refunds = this.sum(buckets.map(({ refundTotal }) => refundTotal));
    const commission = this.sum(
      buckets.map(({ commissionAmount }) => commissionAmount),
    );
    return {
      grossSales: gross.toFixed(2),
      refunds: refunds.toFixed(2),
      commission: commission.toFixed(2),
      payable: gross.sub(refunds).sub(commission).toFixed(2),
    };
  }

  private difference(
    expected: MerchantFinanceAccrualSnapshot[],
    projected: StoredBucket[],
  ): MoneyTotals {
    const expectedTotals = this.decimalTotals(expected);
    const projectedTotals = this.decimalTotals(projected);
    return {
      grossSales: expectedTotals.gross.sub(projectedTotals.gross).toFixed(2),
      refunds: expectedTotals.refunds.sub(projectedTotals.refunds).toFixed(2),
      commission: expectedTotals.commission
        .sub(projectedTotals.commission)
        .toFixed(2),
      payable: expectedTotals.payable.sub(projectedTotals.payable).toFixed(2),
    };
  }

  private decimalTotals(
    buckets: Array<{
      grossSales: Prisma.Decimal;
      refundTotal: Prisma.Decimal;
      commissionAmount: Prisma.Decimal;
    }>,
  ) {
    const gross = this.sum(buckets.map(({ grossSales }) => grossSales));
    const refunds = this.sum(buckets.map(({ refundTotal }) => refundTotal));
    const commission = this.sum(
      buckets.map(({ commissionAmount }) => commissionAmount),
    );
    return {
      gross,
      refunds,
      commission,
      payable: gross.sub(refunds).sub(commission),
    };
  }

  private sum(values: Prisma.Decimal[]): Prisma.Decimal {
    return values.reduce(
      (total, value) => total.add(value),
      new Prisma.Decimal(0),
    );
  }
}
