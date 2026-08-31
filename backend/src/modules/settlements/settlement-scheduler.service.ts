import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  AgreementStatus,
  OrganizationRole,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { currentPhilippineBusinessDate } from '../merchant-agreements/dto/agreement-date.validation';
import { normalSettlementPeriod } from './settlement-period';
import { SettlementsService } from './settlements.service';

@Injectable()
export class SettlementSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SettlementSchedulerService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settlements: SettlementsService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(
      () =>
        void this.generateDue().catch((error: unknown) =>
          this.logger.error('Automatic settlement generation failed', error),
        ),
      24 * 60 * 60 * 1000,
    );
    this.timer.unref();
    void this.generateDue().catch((error: unknown) =>
      this.logger.error('Initial settlement generation failed', error),
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async generateDue(
    organizationId?: string,
  ): Promise<{ generated: number; skipped: number }> {
    const today = currentPhilippineBusinessDate();
    const agreements = await this.prisma.merchantAgreement.findMany({
      where: {
        organizationId,
        status: AgreementStatus.ACTIVE,
        startDate: { lt: today },
      },
      select: {
        organizationId: true,
        merchantId: true,
        settlementSchedule: true,
        startDate: true,
      },
      distinct: ['organizationId', 'merchantId'],
    });
    let generated = 0;
    let skipped = 0;
    for (const agreement of agreements) {
      const latest = await this.prisma.merchantSettlement.findFirst({
        where: {
          organizationId: agreement.organizationId,
          merchantId: agreement.merchantId,
          generationType: 'SCHEDULED',
        },
        select: { periodEnd: true },
        orderBy: { periodEnd: 'desc' },
      });
      const owner = await this.prisma.organizationMembership.findFirst({
        where: {
          organizationId: agreement.organizationId,
          role: OrganizationRole.OWNER,
        },
        select: { userId: true },
      });
      if (!owner) {
        skipped += 1;
        continue;
      }
      let cursor = latest
        ? new Date(latest.periodEnd)
        : new Date(agreement.startDate);
      if (latest) cursor.setUTCDate(cursor.getUTCDate() + 1);
      let attempts = 0;
      while (attempts < 120) {
        const period = normalSettlementPeriod(
          cursor,
          agreement.settlementSchedule,
        );
        if (period.end >= today) break;
        const start = period.start.toISOString().slice(0, 10);
        const end = period.end.toISOString().slice(0, 10);
        try {
          await this.settlements.generateDraft(
            agreement.organizationId,
            agreement.merchantId,
            owner.userId,
            start,
            end,
            {
              generationKey: `${agreement.merchantId}:${start}:${end}`,
            },
          );
          generated += 1;
        } catch (error: unknown) {
          skipped += 1;
          this.logger.warn(
            `Skipped settlement ${agreement.organizationId}/${agreement.merchantId}/${start}/${end}: ${error instanceof Error ? error.message : 'unknown error'}`,
          );
        }
        cursor = new Date(period.end);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        attempts += 1;
      }
    }
    return { generated, skipped };
  }
}
