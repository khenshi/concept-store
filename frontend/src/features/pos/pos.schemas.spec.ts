import { checkoutPaymentSchema } from './pos.schemas';

describe('checkout payment schema', () => {
  it('allows cash without a reference', () => {
    expect(
      checkoutPaymentSchema.parse({ method: 'CASH', referenceNumber: '' }),
    ).toEqual({ method: 'CASH', referenceNumber: '' });
  });

  it('requires and trims a non-cash reference', () => {
    expect(
      checkoutPaymentSchema.safeParse({
        method: 'GCASH',
        referenceNumber: '   ',
      }).success,
    ).toBe(false);
    expect(
      checkoutPaymentSchema.parse({
        method: 'BANK_TRANSFER',
        referenceNumber: '  BANK-1001  ',
      }).referenceNumber,
    ).toBe('BANK-1001');
  });
});
