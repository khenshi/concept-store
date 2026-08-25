import {
  endMerchantAgreementSchema,
  merchantAgreementSchema,
} from './merchant-agreement.schemas';

const validDraft = {
  startDate: '2026-09-01',
  endDate: '',
  fixedRentAmount: '2500.00',
  commissionRate: '5.00',
  settlementSchedule: 'MONTHLY',
};

describe('merchant agreement schemas', () => {
  it('accepts fixed rent, commission, hybrid, and incomplete draft terms', () => {
    expect(merchantAgreementSchema.safeParse(validDraft).success).toBe(true);
    expect(
      merchantAgreementSchema.safeParse({
        ...validDraft,
        commissionRate: '',
      }).success,
    ).toBe(true);
    expect(
      merchantAgreementSchema.safeParse({
        ...validDraft,
        fixedRentAmount: '',
        commissionRate: '',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid money, commission, and date ranges', () => {
    expect(
      merchantAgreementSchema.safeParse({
        ...validDraft,
        fixedRentAmount: '0',
      }).success,
    ).toBe(false);
    expect(
      merchantAgreementSchema.safeParse({
        ...validDraft,
        commissionRate: '100.01',
      }).success,
    ).toBe(false);
    expect(
      merchantAgreementSchema.safeParse({
        ...validDraft,
        endDate: '2026-08-31',
      }).success,
    ).toBe(false);
  });

  it('validates agreement end dates', () => {
    expect(
      endMerchantAgreementSchema.safeParse({ endDate: '2026-09-30' }).success,
    ).toBe(true);
    expect(
      endMerchantAgreementSchema.safeParse({ endDate: '2026-02-30' }).success,
    ).toBe(false);
  });
});
