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

@Injectable()
export class MerchantFinanceAccrualService {
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
