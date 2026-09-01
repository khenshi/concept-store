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
      'REVIEWED',
      'APPROVED',
      'PAID',
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
});
