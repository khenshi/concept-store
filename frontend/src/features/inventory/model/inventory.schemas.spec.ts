import {
  adjustmentInputSchema,
  inventoryPriceSchema,
  receiptInputSchema,
  thresholdInputSchema,
} from './inventory.schemas';

describe('Inventory input schemas', () => {
  it.each(['0', '5', 2147483647])('accepts threshold %s', (value) => {
    expect(
      thresholdInputSchema.parse({ lowStockThreshold: value })
        .lowStockThreshold,
    ).toBe(Number(value));
  });
  it.each(['-1', '1.5', '2147483648', '', null])(
    'rejects threshold %s',
    (value) => {
      expect(
        thresholdInputSchema.safeParse({ lowStockThreshold: value }).success,
      ).toBe(false);
    },
  );
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
  it('normalizes receipt units without a user reason and requires adjustment reasons', () => {
    expect(receiptInputSchema.parse({ quantity: ' 5 ' })).toEqual({
      quantity: 5,
    });
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
    expect(
      adjustmentInputSchema.safeParse({ quantityChange: -2 }).success,
    ).toBe(false);
    expect(
      adjustmentInputSchema.parse({ newQuantity: '0', reason: 'Correction' }),
    ).toEqual({ newQuantity: 0, reason: 'Correction' });
    expect(
      adjustmentInputSchema.safeParse({
        quantityChange: 2,
        newQuantity: 7,
        reason: 'Correction',
      }).success,
    ).toBe(false);
  });
  it.each(['0', '-1', '1.5', '1e2', '2147483648', ''])(
    'rejects invalid receipt units %s',
    (quantity) => {
      expect(receiptInputSchema.safeParse({ quantity }).success).toBe(false);
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
  it.each(['-1', '1.5', '1e2', '2147483648', ''])(
    'rejects invalid absolute stock value %s',
    (newQuantity) => {
      expect(
        adjustmentInputSchema.safeParse({
          newQuantity,
          reason: 'Correction',
        }).success,
      ).toBe(false);
    },
  );
});
