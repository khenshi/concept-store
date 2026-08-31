import { adjustmentSchema, payoutSchema } from './settlement.schemas';

describe('settlement input schemas', () => {
  it('accepts signed adjustments but rejects zero', () => {
    expect(
      adjustmentSchema.safeParse({ amount: '-500.00', reason: 'Correction' })
        .success,
    ).toBe(true);
    expect(
      adjustmentSchema.safeParse({ amount: '0.00', reason: 'No change' })
        .success,
    ).toBe(false);
  });

  it('requires references for non-cash payouts', () => {
    const base = { note: '', paidAt: '2026-08-31T12:00' };
    expect(
      payoutSchema.safeParse({ ...base, method: 'CASH', referenceNumber: '' })
        .success,
    ).toBe(true);
    expect(
      payoutSchema.safeParse({
        ...base,
        method: 'BANK_TRANSFER',
        referenceNumber: '',
      }).success,
    ).toBe(false);
  });
});
