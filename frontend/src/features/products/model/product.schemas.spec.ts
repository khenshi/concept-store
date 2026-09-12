import {
  productCreateSchema,
  productProfileSchema,
  productPlacementResponseSchema,
} from './product.schemas';

describe('Product schemas', () => {
  it('normalizes SKU but preserves barcode identity', () => {
    expect(
      productCreateSchema.parse({
        merchantId: '11111111-1111-4111-8111-111111111111',
        name: ' Vase ',
        sku: ' va-01 ',
        barcode: ' 001Ab ',
      }),
    ).toEqual({
      merchantId: '11111111-1111-4111-8111-111111111111',
      name: 'Vase',
      sku: 'VA-01',
      barcode: '001Ab',
    });
  });
  it('clears optional identifiers on edits', () => {
    expect(
      productProfileSchema.parse({ name: 'Vase', sku: ' ', barcode: '' }),
    ).toEqual({ name: 'Vase', sku: null, barcode: null });
  });
  it.each([
    { name: ' ' },
    { sku: '-AB' },
    { sku: 'AB-' },
    { sku: 'A' },
    { barcode: 'a b' },
    { merchantId: 'bad' },
  ])('rejects invalid identity %j', (extra) => {
    expect(
      productCreateSchema.safeParse({
        name: 'Vase',
        sku: '',
        barcode: '',
        merchantId: '11111111-1111-4111-8111-111111111111',
        ...extra,
      }).success,
    ).toBe(false);
  });
  it('rejects numeric prices in placement responses', () => {
    expect(
      productPlacementResponseSchema.shape.sellingPrice.safeParse(12.5).success,
    ).toBe(false);
    expect(
      productPlacementResponseSchema.shape.sellingPrice.safeParse('0.00')
        .success,
    ).toBe(false);
    expect(
      productPlacementResponseSchema.shape.sellingPrice.safeParse(
        '9999999999.99',
      ).success,
    ).toBe(true);
  });
});
