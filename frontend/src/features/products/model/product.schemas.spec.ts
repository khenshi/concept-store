import {
  productCreateSchema,
  productProfileSchema,
  productPlacementResponseSchema,
} from './product.schemas';

describe('Product schemas', () => {
  const identity = {
    merchantId: '11111111-1111-4111-8111-111111111111',
    name: 'Vase',
    sku: '',
    barcode: '',
  };
  const opening = {
    branchId: identity.merchantId,
    sellingPrice: '0.01',
    quantity: '1',
  };
  it('normalizes opening text to a numeric quantity without converting price to floating point', () => {
    expect(
      productCreateSchema.parse({
        ...identity,
        requestId: identity.merchantId,
        initialInventory: {
          ...opening,
          sellingPrice: ' 9999999999.99 ',
          quantity: '2147483647',
        },
      }),
    ).toMatchObject({
      initialInventory: {
        ...opening,
        sellingPrice: '9999999999.99',
        quantity: 2147483647,
      },
    });
  });
  it.each([
    { requestId: identity.merchantId },
    { initialInventory: opening },
    ...['', '0', '-1', '1.5', '1e2', '2147483648'].map((quantity) => ({
      requestId: identity.merchantId,
      initialInventory: { ...opening, quantity },
    })),
    ...['0', '-1', '1.001', '10000000000', 1].map((sellingPrice) => ({
      requestId: identity.merchantId,
      initialInventory: { ...opening, sellingPrice },
    })),
    {
      requestId: identity.merchantId,
      initialInventory: { ...opening, branchId: '' },
    },
  ])('rejects invalid conditional opening stock %j', (extra) => {
    expect(
      productCreateSchema.safeParse({ ...identity, ...extra }).success,
    ).toBe(false);
  });
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
