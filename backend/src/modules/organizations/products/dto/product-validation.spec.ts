import { ValidationPipe } from '@nestjs/common';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';

const merchantId = '11111111-1111-4111-8111-111111111111';
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

describe('Product request validation', () => {
  it('normalizes name and SKU without losing barcode case or zeroes', async () => {
    await expect(
      pipe.transform(
        { merchantId, name: ' Vase ', sku: ' va-01 ', barcode: ' 001Ab ' },
        { type: 'body', metatype: CreateProductDto },
      ),
    ).resolves.toMatchObject({ name: 'Vase', sku: 'VA-01', barcode: '001Ab' });
  });

  it('clears nullable identifiers on profile edits', async () => {
    await expect(
      pipe.transform(
        { sku: ' ', barcode: null },
        { type: 'body', metatype: UpdateProductDto },
      ),
    ).resolves.toMatchObject({ sku: null, barcode: null });
  });

  it.each([
    { merchantId: 'foreign' },
    { name: ' ' },
    { name: 'x'.repeat(121) },
    { sku: '-AB' },
    { sku: 'AB-' },
    { sku: 'A' },
    { barcode: 'a b' },
    { status: 'INACTIVE' },
    { organizationId: merchantId },
    { sellingPrice: '1' },
  ])('rejects invalid create fields %j', async (extra) => {
    await expect(
      pipe.transform(
        { merchantId, name: 'Vase', ...extra },
        { type: 'body', metatype: CreateProductDto },
      ),
    ).rejects.toThrow();
  });

  it.each([
    { merchantId },
    { status: 'INACTIVE' },
    { quantity: 1 },
    { name: null },
  ])('rejects protected or invalid update fields %j', async (body) => {
    await expect(
      pipe.transform(body, { type: 'body', metatype: UpdateProductDto }),
    ).rejects.toThrow();
  });
});
