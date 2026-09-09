import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AgreementStatus,
  MerchantFinanceAccrualKind,
  Prisma,
  type MerchantAgreement,
} from '../../generated/prisma/client';
import {
  normalSettlementPeriod,
  philippineDate,
} from '../settlements/settlement-period';

export interface SaleAccrualBucket {
  organizationId: string;
  merchantId: string;
  agreementId: string;
  periodStart: Date;
  periodEnd: Date;
  schedule: MerchantAgreement['settlementSchedule'];
  kind: MerchantFinanceAccrualKind;
  commissionRate: Prisma.Decimal | null;
  grossSales: Prisma.Decimal;
}

interface MerchantSaleAmount {
  merchantId: string;
  amount: Prisma.Decimal;
}

export interface CompletedRefundAccrualItem {
  merchantId: string;
  amount: Prisma.Decimal;
  originalSaleCompletedAt: Date;
  originalSaleCaptured: boolean;
}

export type MerchantFinanceAccrualSnapshot = SaleAccrualBucket & {
  refundTotal: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
};

@Injectable()
export class MerchantFinanceAccrualService {
  async addCompletedRefund(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    completedAt: Date,
    items: CompletedRefundAccrualItem[],
  ): Promise<void> {
    const buckets = await this.prepareRefundBuckets(
      transaction,
      organizationId,
      completedAt,
      items,
    );
    await this.addRefundBuckets(transaction, buckets);
  }

  async calculateMerchantProjection(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    merchantId: string,
  ): Promise<MerchantFinanceAccrualSnapshot[]> {
    const agreements = await transaction.merchantAgreement.findMany({
      where: {
        organizationId,
        merchantId,
        status: { in: [AgreementStatus.ACTIVE, AgreementStatus.ENDED] },
      },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
    });
    const saleItems = await transaction.saleItem.findMany({
      where: {
        organizationId,
        merchantId,
        sale: { status: 'COMPLETED' },
        settlementLinks: { none: { releasedAt: null } },
      },
      select: { total: true, sale: { select: { completedAt: true } } },
      orderBy: [{ sale: { completedAt: 'asc' } }, { id: 'asc' }],
    });
    const refundItems = await transaction.saleRefundItem.findMany({
      where: {
        organizationId,
        merchantId,
        refund: { status: 'COMPLETED' },
        settlementLinks: { none: { releasedAt: null } },
      },
      select: {
        amount: true,
        refund: { select: { completedAt: true } },
        saleItem: {
          select: {
            sale: { select: { completedAt: true } },
            settlementLinks: {
              where: { releasedAt: null },
              select: { settlementId: true },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ refund: { completedAt: 'asc' } }, { id: 'asc' }],
    });

    const buckets = new Map<
      string,
      SaleAccrualBucket & { refundTotal: Prisma.Decimal }
    >();
    const add = (
      activityAt: Date,
      agreement: MerchantAgreement,
      kind: MerchantFinanceAccrualKind,
      gross: Prisma.Decimal,
      refund: Prisma.Decimal,
    ) => {
      const bucket = this.bucketFor(
        organizationId,
        merchantId,
        agreement,
        activityAt,
        kind,
        kind === MerchantFinanceAccrualKind.EARNED_ACTIVITY,
      );
      const key = this.bucketKey(bucket);
      const current = buckets.get(key);
      if (current) {
        current.grossSales = current.grossSales.add(gross);
        current.refundTotal = current.refundTotal.add(refund);
      } else {
        buckets.set(key, { ...bucket, grossSales: gross, refundTotal: refund });
      }
    };
    for (const item of saleItems) {
      const agreement = this.effectiveAgreement(
        agreements,
        item.sale.completedAt,
      );
      add(
        item.sale.completedAt,
        agreement,
        MerchantFinanceAccrualKind.EARNED_ACTIVITY,
        item.total,
        new Prisma.Decimal(0),
      );
    }
    for (const item of refundItems) {
      const originalAt = item.saleItem.sale.completedAt;
      const agreement = this.effectiveAgreement(agreements, originalAt);
      const captured = item.saleItem.settlementLinks.length > 0;
      add(
        captured ? item.refund.completedAt : originalAt,
        agreement,
        captured
          ? MerchantFinanceAccrualKind.POST_SETTLEMENT_REFUND
          : MerchantFinanceAccrualKind.EARNED_ACTIVITY,
        new Prisma.Decimal(0),
        item.amount,
      );
    }

    return [...buckets.values()]
      .sort((a, b) => this.bucketKey(a).localeCompare(this.bucketKey(b)))
      .map((bucket) => ({
        ...bucket,
        commissionAmount:
          bucket.kind === MerchantFinanceAccrualKind.POST_SETTLEMENT_REFUND
            ? this.refundCommission(bucket.refundTotal, bucket.commissionRate)
            : this.commissionFor(
                bucket.grossSales.sub(bucket.refundTotal),
                bucket.commissionRate,
              ),
      }));
  }

  async rebuildMerchant(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    merchantId: string,
  ): Promise<void> {
    await transaction.$executeRaw(Prisma.sql`
      SELECT "id" FROM "Merchant"
      WHERE "organizationId" = ${organizationId} AND "id" = ${merchantId}
      FOR UPDATE
    `);
    const currentRevision = await transaction.merchantFinanceAccrual.aggregate({
      where: { organizationId, merchantId },
      _max: { revision: true },
    });
    const buckets = await this.calculateMerchantProjection(
      transaction,
      organizationId,
      merchantId,
    );
    await transaction.merchantFinanceAccrual.deleteMany({
      where: { organizationId, merchantId },
    });
    for (const bucket of buckets) {
      await this.insertRebuiltBucket(
        transaction,
        bucket,
        (currentRevision._max.revision ?? 0n) + 1n,
      );
    }
  }
  prepareCompletedSale(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    completedAt: Date,
    items: MerchantSaleAmount[],
  ): Promise<SaleAccrualBucket[]> {
    return this.prepareSaleBuckets(
      transaction,
      organizationId,
      completedAt,
      items,
      [AgreementStatus.ACTIVE],
    );
  }

  prepareSaleReversal(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    completedAt: Date,
    items: MerchantSaleAmount[],
  ): Promise<SaleAccrualBucket[]> {
    return this.prepareSaleBuckets(
      transaction,
      organizationId,
      completedAt,
      items,
      [AgreementStatus.ACTIVE, AgreementStatus.ENDED],
    );
  }

  async addCompletedSale(
    transaction: Prisma.TransactionClient,
    buckets: SaleAccrualBucket[],
  ): Promise<void> {
    await this.lockMerchants(transaction, buckets);
    for (const bucket of this.sorted(buckets)) {
      const commissionAmount = this.commissionFor(
        bucket.grossSales,
        bucket.commissionRate,
      );
      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO "MerchantFinanceAccrual" (
          "id",
          "organizationId",
          "merchantId",
          "agreementId",
          "periodStart",
          "periodEnd",
          "schedule",
          "kind",
          "commissionRate",
          "grossSales",
          "refundTotal",
          "commissionAmount",
          "revision",
          "createdAt",
          "updatedAt"
        ) VALUES (
          ${randomUUID()},
          ${bucket.organizationId},
          ${bucket.merchantId},
          ${bucket.agreementId},
          ${bucket.periodStart},
          ${bucket.periodEnd},
          ${bucket.schedule}::"SettlementSchedule",
          'EARNED_ACTIVITY'::"MerchantFinanceAccrualKind",
          ${bucket.commissionRate},
          ${bucket.grossSales},
          0,
          ${commissionAmount},
          1,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (
          "organizationId",
          "merchantId",
          "agreementId",
          "periodStart",
          "periodEnd",
          "kind"
        ) DO UPDATE SET
          "grossSales" = "MerchantFinanceAccrual"."grossSales"
            + EXCLUDED."grossSales",
          "commissionAmount" = ROUND(
            GREATEST(
              "MerchantFinanceAccrual"."grossSales"
                + EXCLUDED."grossSales"
                - "MerchantFinanceAccrual"."refundTotal",
              0
            ) * COALESCE("MerchantFinanceAccrual"."commissionRate", 0) / 100,
            2
          ),
          "revision" = "MerchantFinanceAccrual"."revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      `);
    }
  }

  async removeCompletedSale(
    transaction: Prisma.TransactionClient,
    buckets: SaleAccrualBucket[],
  ): Promise<void> {
    await this.lockMerchants(transaction, buckets);
    for (const bucket of this.sorted(buckets)) {
      const existing = await transaction.merchantFinanceAccrual.findUnique({
        where: {
          bucket: {
            organizationId: bucket.organizationId,
            merchantId: bucket.merchantId,
            agreementId: bucket.agreementId,
            periodStart: bucket.periodStart,
            periodEnd: bucket.periodEnd,
            kind: MerchantFinanceAccrualKind.EARNED_ACTIVITY,
          },
        },
        select: { grossSales: true },
      });
      // Part 1 runs in shadow mode before historical backfill. A missing row
      // therefore means this sale predates projection maintenance.
      if (!existing) continue;
      if (existing.grossSales.lt(bucket.grossSales)) {
        throw new ConflictException(
          'Merchant payable projection is inconsistent; reconcile it before voiding this sale',
        );
      }
      const changed = await transaction.$executeRaw(Prisma.sql`
        UPDATE "MerchantFinanceAccrual"
        SET
          "grossSales" = "grossSales" - ${bucket.grossSales},
          "commissionAmount" = ROUND(
            GREATEST(
              "grossSales" - ${bucket.grossSales} - "refundTotal",
              0
            ) * COALESCE("commissionRate", 0) / 100,
            2
          ),
          "revision" = "revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "organizationId" = ${bucket.organizationId}
          AND "merchantId" = ${bucket.merchantId}
          AND "agreementId" = ${bucket.agreementId}
          AND "periodStart" = ${bucket.periodStart}
          AND "periodEnd" = ${bucket.periodEnd}
          AND "kind" = 'EARNED_ACTIVITY'::"MerchantFinanceAccrualKind"
          AND "grossSales" >= ${bucket.grossSales}
      `);
      if (changed !== 1) {
        throw new ConflictException(
          'Merchant payable projection changed concurrently; retry the sale void',
        );
      }
    }
  }

  private async prepareSaleBuckets(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    completedAt: Date,
    items: MerchantSaleAmount[],
    statuses: AgreementStatus[],
  ): Promise<SaleAccrualBucket[]> {
    const amountByMerchant = new Map<string, Prisma.Decimal>();
    for (const item of items) {
      amountByMerchant.set(
        item.merchantId,
        (amountByMerchant.get(item.merchantId) ?? new Prisma.Decimal(0)).add(
          item.amount,
        ),
      );
    }
    const merchantIds = [...amountByMerchant.keys()].sort();
    const activityDate = philippineDate(completedAt);
    const agreements = await transaction.merchantAgreement.findMany({
      where: {
        organizationId,
        merchantId: { in: merchantIds },
        status: { in: statuses },
        startDate: { lte: activityDate },
        OR: [{ endDate: null }, { endDate: { gte: activityDate } }],
      },
      orderBy: [{ merchantId: 'asc' }, { startDate: 'desc' }, { id: 'asc' }],
    });
    const agreementByMerchant = new Map<string, MerchantAgreement>();
    for (const agreement of agreements) {
      if (agreementByMerchant.has(agreement.merchantId)) {
        throw new ConflictException(
          'Merchant agreement dates overlap; correct them before completing this sale',
        );
      }
      agreementByMerchant.set(agreement.merchantId, agreement);
    }
    if (agreementByMerchant.size !== merchantIds.length) {
      throw new ConflictException(
        'Every merchant in the cart requires an active agreement before checkout',
      );
    }

    return merchantIds.map((merchantId) => {
      const agreement = agreementByMerchant.get(merchantId)!;
      const normalPeriod = normalSettlementPeriod(
        activityDate,
        agreement.settlementSchedule,
      );
      const periodStart =
        agreement.startDate > normalPeriod.start
          ? agreement.startDate
          : normalPeriod.start;
      const periodEnd =
        agreement.endDate && agreement.endDate < normalPeriod.end
          ? agreement.endDate
          : normalPeriod.end;
      return {
        organizationId,
        merchantId,
        agreementId: agreement.id,
        periodStart,
        periodEnd,
        schedule: agreement.settlementSchedule,
        kind: MerchantFinanceAccrualKind.EARNED_ACTIVITY,
        commissionRate: agreement.commissionRate,
        grossSales: amountByMerchant.get(merchantId)!,
      };
    });
  }

  private async prepareRefundBuckets(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    completedAt: Date,
    items: CompletedRefundAccrualItem[],
  ): Promise<Array<SaleAccrualBucket & { refundTotal: Prisma.Decimal }>> {
    const merchantIds = [
      ...new Set(items.map(({ merchantId }) => merchantId)),
    ].sort();
    const agreements = await transaction.merchantAgreement.findMany({
      where: {
        organizationId,
        merchantId: { in: merchantIds },
        status: { in: [AgreementStatus.ACTIVE, AgreementStatus.ENDED] },
      },
      orderBy: [{ merchantId: 'asc' }, { startDate: 'asc' }, { id: 'asc' }],
    });
    const buckets = new Map<
      string,
      SaleAccrualBucket & { refundTotal: Prisma.Decimal }
    >();
    for (const item of items) {
      const agreement = this.effectiveAgreement(
        agreements.filter(({ merchantId }) => merchantId === item.merchantId),
        item.originalSaleCompletedAt,
      );
      const kind = item.originalSaleCaptured
        ? MerchantFinanceAccrualKind.POST_SETTLEMENT_REFUND
        : MerchantFinanceAccrualKind.EARNED_ACTIVITY;
      const bucket = this.bucketFor(
        organizationId,
        item.merchantId,
        agreement,
        item.originalSaleCaptured ? completedAt : item.originalSaleCompletedAt,
        kind,
        !item.originalSaleCaptured,
      );
      const key = this.bucketKey(bucket);
      const current = buckets.get(key);
      if (current) current.refundTotal = current.refundTotal.add(item.amount);
      else buckets.set(key, { ...bucket, refundTotal: item.amount });
    }
    return [...buckets.values()].sort((a, b) =>
      this.bucketKey(a).localeCompare(this.bucketKey(b)),
    );
  }

  private async addRefundBuckets(
    transaction: Prisma.TransactionClient,
    buckets: Array<SaleAccrualBucket & { refundTotal: Prisma.Decimal }>,
  ): Promise<void> {
    await this.lockMerchants(transaction, buckets);
    for (const bucket of buckets) {
      const commissionAmount = this.refundCommission(
        bucket.refundTotal,
        bucket.commissionRate,
      );
      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO "MerchantFinanceAccrual" (
          "id", "organizationId", "merchantId", "agreementId", "periodStart",
          "periodEnd", "schedule", "kind", "commissionRate", "grossSales",
          "refundTotal", "commissionAmount", "revision", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${bucket.organizationId}, ${bucket.merchantId},
          ${bucket.agreementId}, ${bucket.periodStart}, ${bucket.periodEnd},
          ${bucket.schedule}::"SettlementSchedule",
          ${bucket.kind}::"MerchantFinanceAccrualKind", ${bucket.commissionRate},
          0, ${bucket.refundTotal}, ${commissionAmount}, 1,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (
          "organizationId", "merchantId", "agreementId", "periodStart", "periodEnd", "kind"
        ) DO UPDATE SET
          "refundTotal" = "MerchantFinanceAccrual"."refundTotal" + EXCLUDED."refundTotal",
          "commissionAmount" = CASE
            WHEN "MerchantFinanceAccrual"."kind" = 'POST_SETTLEMENT_REFUND'::"MerchantFinanceAccrualKind"
              THEN -ROUND(("MerchantFinanceAccrual"."refundTotal" + EXCLUDED."refundTotal")
                * COALESCE("MerchantFinanceAccrual"."commissionRate", 0) / 100, 2)
            ELSE ROUND(GREATEST("MerchantFinanceAccrual"."grossSales"
                - "MerchantFinanceAccrual"."refundTotal" - EXCLUDED."refundTotal", 0)
                * COALESCE("MerchantFinanceAccrual"."commissionRate", 0) / 100, 2)
          END,
          "revision" = "MerchantFinanceAccrual"."revision" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      `);
    }
  }

  private async insertRebuiltBucket(
    transaction: Prisma.TransactionClient,
    bucket: SaleAccrualBucket & { refundTotal: Prisma.Decimal },
    revision: bigint,
  ): Promise<void> {
    const commissionAmount =
      bucket.kind === MerchantFinanceAccrualKind.POST_SETTLEMENT_REFUND
        ? this.refundCommission(bucket.refundTotal, bucket.commissionRate)
        : this.commissionFor(
            bucket.grossSales.sub(bucket.refundTotal),
            bucket.commissionRate,
          );
    await transaction.merchantFinanceAccrual.create({
      data: { ...bucket, commissionAmount, revision },
    });
  }

  private effectiveAgreement(
    agreements: MerchantAgreement[],
    activityAt: Date,
  ): MerchantAgreement {
    const date = philippineDate(activityAt);
    const matches = agreements.filter(
      ({ startDate, endDate }) =>
        startDate <= date && (!endDate || endDate >= date),
    );
    if (matches.length !== 1) {
      throw new ConflictException(
        matches.length === 0
          ? 'The original sale is not covered by an effective merchant agreement'
          : 'Merchant agreement dates overlap; correct them before updating finance',
      );
    }
    return matches[0];
  }

  private bucketFor(
    organizationId: string,
    merchantId: string,
    agreement: MerchantAgreement,
    activityAt: Date,
    kind: MerchantFinanceAccrualKind,
    clampToAgreement: boolean,
  ): SaleAccrualBucket {
    const period = normalSettlementPeriod(
      philippineDate(activityAt),
      agreement.settlementSchedule,
    );
    return {
      organizationId,
      merchantId,
      agreementId: agreement.id,
      periodStart:
        clampToAgreement && agreement.startDate > period.start
          ? agreement.startDate
          : period.start,
      periodEnd:
        clampToAgreement && agreement.endDate && agreement.endDate < period.end
          ? agreement.endDate
          : period.end,
      schedule: agreement.settlementSchedule,
      kind,
      commissionRate: agreement.commissionRate,
      grossSales: new Prisma.Decimal(0),
    };
  }

  private bucketKey(bucket: SaleAccrualBucket): string {
    return [
      bucket.organizationId,
      bucket.merchantId,
      bucket.agreementId,
      bucket.periodStart.toISOString(),
      bucket.periodEnd.toISOString(),
      bucket.kind,
    ].join(':');
  }

  private async lockMerchants(
    transaction: Prisma.TransactionClient,
    buckets: SaleAccrualBucket[],
  ): Promise<void> {
    const targets = [
      ...new Map(
        buckets.map(({ organizationId, merchantId }) => [
          `${organizationId}:${merchantId}`,
          { organizationId, merchantId },
        ]),
      ).values(),
    ].sort((left, right) =>
      `${left.organizationId}:${left.merchantId}`.localeCompare(
        `${right.organizationId}:${right.merchantId}`,
      ),
    );
    for (const target of targets) {
      await transaction.$executeRaw(Prisma.sql`
        SELECT "id" FROM "Merchant"
        WHERE "organizationId" = ${target.organizationId}
          AND "id" = ${target.merchantId}
        FOR UPDATE
      `);
    }
  }

  private refundCommission(
    refund: Prisma.Decimal,
    commissionRate: Prisma.Decimal | null,
  ): Prisma.Decimal {
    return this.commissionFor(refund, commissionRate).negated();
  }

  private commissionFor(
    netSales: Prisma.Decimal,
    commissionRate: Prisma.Decimal | null,
  ): Prisma.Decimal {
    return commissionRate && netSales.gt(0)
      ? netSales
          .mul(commissionRate)
          .div(100)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      : new Prisma.Decimal(0);
  }

  private sorted(buckets: SaleAccrualBucket[]): SaleAccrualBucket[] {
    return [...buckets].sort((left, right) =>
      [
        left.organizationId,
        left.merchantId,
        left.agreementId,
        left.periodStart.toISOString(),
      ]
        .join(':')
        .localeCompare(
          [
            right.organizationId,
            right.merchantId,
            right.agreementId,
            right.periodStart.toISOString(),
          ].join(':'),
        ),
    );
  }
}
