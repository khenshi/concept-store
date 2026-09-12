import {
  adjustmentInputSchema,
  inventoryPriceSchema,
  receiptInputSchema,
} from './inventory.schemas';

describe('Inventory input schemas', () => {
  it.each(['0.01', '1', '9999999999.99', ' 12.50 '])(
    'accepts decimal-string price %s',
    (value) => {
      expect(inventoryPriceSchema.parse(value)).toBe(value.trim());
    },
  );
  it.each([0, 12.5, '0', '0.00', '-1', '1e2', '1.001', '10000000000'])(
    'rejects invalid price %s',
    (value) => {
      expect(inventoryPriceSchema.safeParse(value).success).toBe(false);
    },
  );
  it('normalizes whole-unit inputs and required reasons', () => {
    expect(
      receiptInputSchema.parse({ quantity: ' 5 ', reason: ' Delivery ' }),
    ).toEqual({ quantity: 5, reason: 'Delivery' });
    expect(
      adjustmentInputSchema.parse({
        quantityChange: '-2',
        reason: ' Correction ',
      }),
    ).toEqual({ quantityChange: -2, reason: 'Correction' });
    expect(
      adjustmentInputSchema.parse({
        quantityChange: '+5',
        reason: 'Correction',
      }).quantityChange,
    ).toBe(5);
  });
  it.each(['0', '-1', '1.5', '1e2', '2147483648', ''])(
    'rejects invalid receipt units %s',
    (quantity) => {
      expect(
        receiptInputSchema.safeParse({ quantity, reason: 'Delivery' }).success,
      ).toBe(false);
    },
  );
  it.each(['0', '-2147483649', '2147483648', '1.5'])(
    'rejects invalid adjustment %s',
    (quantityChange) => {
      expect(
        adjustmentInputSchema.safeParse({
          quantityChange,
          reason: 'Correction',
        }).success,
      ).toBe(false);
    },
  );
});
