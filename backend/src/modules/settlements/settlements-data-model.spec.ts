import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PayoutMethod,
  Prisma,
  SettlementStatus,
} from '../../generated/prisma/client';

describe('Milestone 6 merchant finance data model', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'prisma/migrations/20260830000000_add_merchant_finance_foundation/migration.sql',
    ),
    'utf8',
  );
  const hardeningMigration = readFileSync(
    join(
      process.cwd(),
      'prisma/migrations/20260907120000_finance_workflow_hardening/migration.sql',
    ),
    'utf8',
  );
  const commissionReversalMigration = readFileSync(
    join(
      process.cwd(),
      'prisma/migrations/20260909120000_allow_settlement_commission_reversals/migration.sql',
    ),
    'utf8',
  );

  it('generates the settlement persistence entities', () => {
    expect(Prisma.ModelName).toEqual(
      expect.objectContaining({
        MerchantSettlement: 'MerchantSettlement',
        SettlementTermSnapshot: 'SettlementTermSnapshot',
        SettlementSaleItem: 'SettlementSaleItem',
        MerchantFinanceEntry: 'MerchantFinanceEntry',
        MerchantPayout: 'MerchantPayout',
      }),
    );
  });

  it('uses the approved settlement lifecycle and manual payout methods', () => {
    expect(Object.values(SettlementStatus)).toEqual([
      'DRAFT',
      'APPROVED',
      'PAID',
      'CANCELLED',
    ]);
    expect(Object.values(PayoutMethod)).toEqual([
      'CASH',
      'GCASH',
      'BANK_TRANSFER',
      'OTHER',
    ]);
  });

  it('keeps overlapping periods and duplicate sale-item settlement database-enforced', () => {
    expect(migration).toContain(
      'MerchantSettlement_no_overlapping_periods_excl',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "SettlementSaleItem_saleItemId_key"',
    );
  });

  it('keeps settlement totals, lifecycle actors, and payout references database-enforced', () => {
    expect(migration).toContain('MerchantSettlement_total_check');
    expect(migration).toContain('MerchantSettlement_lifecycle_check');
    expect(migration).toContain('MerchantPayout_non_cash_reference_check');
  });

  it('migrates the simplified lifecycle and preserves only unreleased source uniqueness', () => {
    expect(hardeningMigration).toContain('WHERE "status" = \'REVIEWED\'');
    expect(hardeningMigration).toContain(
      "WHERE \"status\" IN ('DRAFT', 'APPROVED')",
    );
    expect(hardeningMigration).toContain(
      'SettlementSaleItem_active_source_key',
    );
    expect(hardeningMigration).toContain(
      'SettlementReceivableAllocation_active_key',
    );
    expect(hardeningMigration).toContain('ALTER TABLE "SettlementAdjustment"');
    expect(hardeningMigration).not.toContain(
      'ALTER TABLE "MerchantFinanceEntry"',
    );
  });

  it('allows bounded commission reversals for post-settlement refunds', () => {
    expect(commissionReversalMigration).toContain(
      '"commissionAmount" >= -"refundTotal"',
    );
    expect(commissionReversalMigration).toContain(
      '"commissionAmount" <= "grossSales"',
    );
  });
});
