import {
  InventoryMovementType,
  PaymentMethod,
  Prisma,
} from '../../generated/prisma/client';

describe('Milestone 5 sales data model', () => {
  it('generates the sales entities required for checkout persistence', () => {
    expect(Prisma.ModelName).toEqual(
      expect.objectContaining({
        Sale: 'Sale',
        SaleItem: 'SaleItem',
        Payment: 'Payment',
      }),
    );
  });

  it('supports only the initial manual payment methods', () => {
    expect(Object.values(PaymentMethod)).toEqual([
      'CASH',
      'GCASH',
      'BANK_TRANSFER',
      'OTHER',
    ]);
  });

  it('adds sale attribution to the inventory movement audit types', () => {
    expect(InventoryMovementType.SALE).toBe('SALE');
  });
});
