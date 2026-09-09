import {
  merchantAgreementSchema,
  reasonSchema,
} from './merchant-agreement.schemas';

const validAgreement = {
  activationAt: '2026-09-10',
  durationMonths: 12,
  spaceIds: ['11111111-1111-4111-8111-111111111111'],
  fixedRentAmount: '2500.00',
  commissionRate: '',
  securityDepositAmount: '5000.00',
  firstRentPaymentRequired: true,
  rentDueWeek: 'LAST',
  rentDueWeekday: 'FRIDAY',
  settlementSchedule: 'MONTHLY',
} as const;

describe('merchant agreement schema', () => {
  it('accepts an agreement-led rental draft', () => {
    expect(merchantAgreementSchema.safeParse(validAgreement).success).toBe(
      true,
    );
  });

  it('requires at least one space and one commercial term', () => {
    const result = merchantAgreementSchema.safeParse({
      ...validAgreement,
      spaceIds: [],
      fixedRentAmount: '',
      commissionRate: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.spaceIds).toBeDefined();
      expect(result.error.flatten().fieldErrors.fixedRentAmount).toContain(
        'Enter rent, commission, or both.',
      );
    }
  });

  it('requires rent timing and disallows first-rent prepayment without rent', () => {
    expect(
      merchantAgreementSchema.safeParse({
        ...validAgreement,
        rentDueWeek: '',
      }).success,
    ).toBe(false);
    expect(
      merchantAgreementSchema.safeParse({
        ...validAgreement,
        fixedRentAmount: '',
        commissionRate: '8.5',
      }).success,
    ).toBe(false);
  });

  it('requires lifecycle reasons', () => {
    expect(reasonSchema.safeParse('  ').success).toBe(false);
    expect(reasonSchema.parse('Needs correction')).toBe('Needs correction');
  });
});
