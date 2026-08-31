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
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const agreements = await this.prisma.merchantAgreement.findMany({
      where: {
        organizationId,
        status: AgreementStatus.ACTIVE,
        startDate: { lte: yesterday },
      },
      select: {
        organizationId: true,
        merchantId: true,
        settlementSchedule: true,
      },
      distinct: ['organizationId', 'merchantId'],
    });
    let generated = 0;
    let skipped = 0;
    for (const agreement of agreements) {
      const period = normalSettlementPeriod(
        yesterday,
        agreement.settlementSchedule,
      );
      if (period.end.getTime() !== yesterday.getTime()) {
        skipped += 1;
        continue;
      }
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
      } catch {
        skipped += 1;
      }
    }
    return { generated, skipped };
  }
}
