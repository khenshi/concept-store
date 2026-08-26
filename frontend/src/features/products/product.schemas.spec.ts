import { productSchema } from './product.schemas';

describe('product schema', () => {
  const merchantId = '2f671678-91d3-4d04-a8f9-787a2e9f3c1a';

  it('normalizes product codes and optional barcode input', () => {
    expect(
      productSchema.parse({
        merchantId,
        name: '  Handwoven pouch ',
        sku: ' amh-01 ',
        barcode: ' ',
        sellingPrice: ' 450.00 ',
      }),
    ).toEqual({
      merchantId,
      name: 'Handwoven pouch',
      sku: 'AMH-01',
      barcode: null,
      sellingPrice: '450.00',
    });
  });

  it.each(['A', 'AMH 01', 'AMH--01', '_AMH'])(
    'rejects invalid SKU %s',
    (sku) => {
      expect(
        productSchema.safeParse({
          merchantId,
          name: 'Handwoven pouch',
          sku,
          barcode: '',
          sellingPrice: '450.00',
        }).success,
      ).toBe(false);
    },
  );

  it.each(['0', '-10', '12.345', 'free'])(
    'rejects invalid price %s',
    (sellingPrice) => {
      expect(
        productSchema.safeParse({
          merchantId,
          name: 'Handwoven pouch',
          sku: 'AMH-01',
          barcode: '',
          sellingPrice,
        }).success,
      ).toBe(false);
    },
  );
});
