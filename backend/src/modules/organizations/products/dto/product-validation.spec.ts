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
  const initialInventory = {
    branchId: merchantId,
    sellingPrice: '0.01',
    quantity: 1,
  };

  it('normalizes opening identifiers and price while retaining integer bounds', async () => {
    await expect(
      pipe.transform(
        {
          merchantId,
          name: 'Vase',
          requestId: merchantId.toUpperCase(),
          initialInventory: {
            ...initialInventory,
            sellingPrice: ' 9999999999.99 ',
            quantity: 2147483647,
          },
        },
        { type: 'body', metatype: CreateProductDto },
      ),
    ).resolves.toMatchObject({
      requestId: merchantId,
      initialInventory: {
        ...initialInventory,
        sellingPrice: '9999999999.99',
        quantity: 2147483647,
      },
    });
  });

  it.each([
    { requestId: merchantId },
    { initialInventory },
    { initialInventory: null, requestId: merchantId },
    { initialInventory: [], requestId: merchantId },
    { requestId: 'invalid', initialInventory },
    ...[0, -1, 1.5, '1', 2147483648, null].map((quantity) => ({
      requestId: merchantId,
      initialInventory: { ...initialInventory, quantity },
    })),
    ...['0', '-1', '1.001', '10000000000', 1, null].map((sellingPrice) => ({
      requestId: merchantId,
      initialInventory: { ...initialInventory, sellingPrice },
    })),
    {
      requestId: merchantId,
      initialInventory: { ...initialInventory, branchId: 'foreign' },
    },
    {
      requestId: merchantId,
      initialInventory: { ...initialInventory, reason: 'Client reason' },
    },
    { creationActorId: merchantId },
    { creationRequestId: merchantId },
    { creationCommand: {} },
  ])('rejects invalid opening stock input %j', async (extra) => {
    await expect(
      pipe.transform(
        { merchantId, name: 'Vase', ...extra },
        { type: 'body', metatype: CreateProductDto },
      ),
    ).rejects.toThrow();
  });
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
