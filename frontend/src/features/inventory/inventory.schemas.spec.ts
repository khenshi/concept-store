import { inventoryAdjustmentSchema, stockInSchema } from './inventory.schemas';

describe('inventory operation schemas', () => {
  const productId = '84f45f0b-b07b-430d-9a62-5c96030c762a';
  const branchId = '6b109a2f-142c-4af4-93d8-12941d0685ac';

  it('normalizes a stock-in form', () => {
    expect(
      stockInSchema.parse({
        productId,
        branchId,
        quantity: '12',
        referenceId: ' DELIVERY-1 ',
        note: ' ',
      }),
    ).toEqual({
      productId,
      branchId,
      quantity: 12,
      referenceId: 'DELIVERY-1',
      note: undefined,
    });
  });

  it('rejects zero and fractional stock-in quantities', () => {
    expect(
      stockInSchema.safeParse({
        productId,
        branchId,
        quantity: '0',
        referenceId: '',
        note: '',
      }).success,
    ).toBe(false);
    expect(
      stockInSchema.safeParse({
        productId,
        branchId,
        quantity: '1.5',
        referenceId: '',
        note: '',
      }).success,
    ).toBe(false);
  });

  it('accepts a signed explained adjustment', () => {
    expect(
      inventoryAdjustmentSchema.parse({
        productId,
        branchId,
        quantityChange: '-2',
        note: ' Physical count ',
        referenceId: '',
      }),
    ).toEqual({
      productId,
      branchId,
      quantityChange: -2,
      note: 'Physical count',
      referenceId: undefined,
    });
  });

  it('rejects an unexplained or zero adjustment', () => {
    expect(
      inventoryAdjustmentSchema.safeParse({
        productId,
        branchId,
        quantityChange: '0',
        note: '',
        referenceId: '',
      }).success,
    ).toBe(false);
  });
});
