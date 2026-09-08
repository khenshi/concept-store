import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MerchantFinanceAccrualKind,
  Prisma,
} from '../../generated/prisma/client';

describe('Merchant finance accrual data model', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'prisma/migrations/20260908120000_add_merchant_finance_accrual/migration.sql',
    ),
    'utf8',
  );

  it('generates the accrual model and activity kinds', () => {
    expect(Prisma.ModelName.MerchantFinanceAccrual).toBe(
      'MerchantFinanceAccrual',
    );
    expect(Object.values(MerchantFinanceAccrualKind)).toEqual([
      'EARNED_ACTIVITY',
      'POST_SETTLEMENT_REFUND',
    ]);
  });

  it('enforces tenant relationships, bucket uniqueness, and numeric checks', () => {
    expect(migration).toContain('MerchantFinanceAccrual_bucket_key');
    expect(migration).toContain(
      'MerchantFinanceAccrual_merchantId_organizationId_fkey',
    );
    expect(migration).toContain(
      'MerchantFinanceAccrual_agreementId_organizationId_fkey',
    );
    expect(migration).toContain('MerchantFinanceAccrual_amounts_check');
    expect(migration).toContain(
      'MerchantFinanceAccrual_organization_period_idx',
    );
  });
});
