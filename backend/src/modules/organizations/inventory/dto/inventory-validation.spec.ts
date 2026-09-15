import { ValidationPipe } from '@nestjs/common';
import { InventoryPriceDto } from './inventory-price.dto';
import { CreateBranchInventoryDto } from './create-branch-inventory.dto';
import { AdjustInventoryDto, ReceiveInventoryDto } from './stock-command.dto';

const requestId = '11111111-1111-4111-8111-111111111111';
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

describe('Inventory request validation', () => {
  it.each([undefined, 0, 5, 2147483647])(
    'accepts placement threshold %s',
    async (lowStockThreshold) => {
      await expect(
        pipe.transform(
          {
            productId: requestId,
            sellingPrice: '12.50',
            ...(lowStockThreshold === undefined ? {} : { lowStockThreshold }),
          },
          { type: 'body', metatype: CreateBranchInventoryDto },
        ),
      ).resolves.toMatchObject({
        productId: requestId,
        ...(lowStockThreshold === undefined ? {} : { lowStockThreshold }),
      });
    },
  );

  it.each([-1, 1.5, '5', 2147483648, null])(
    'rejects placement threshold %s',
    async (lowStockThreshold) => {
      await expect(
        pipe.transform(
          { productId: requestId, sellingPrice: '12.50', lowStockThreshold },
          { type: 'body', metatype: CreateBranchInventoryDto },
        ),
      ).rejects.toThrow();
    },
  );
  it.each(['0.01', '1', '9999999999.99', ' 12.50 '])(
    'accepts precise price %s',
    async (sellingPrice) => {
      await expect(
        pipe.transform(
          { sellingPrice },
          { type: 'body', metatype: InventoryPriceDto },
        ),
      ).resolves.toMatchObject({ sellingPrice: sellingPrice.trim() });
    },
  );

  it.each([
    0,
    12.5,
    '0',
    '0.00',
    '-1',
    '1e2',
    '1.001',
    '10000000000',
    '',
    null,
  ])('rejects invalid price %s', async (sellingPrice) => {
    await expect(
      pipe.transform(
        { sellingPrice },
        { type: 'body', metatype: InventoryPriceDto },
      ),
    ).rejects.toThrow();
  });

  it.each([0, -1, 1.5, '1', 2147483648, null])(
    'rejects receipt quantity %s',
    async (quantity) => {
      await expect(
        pipe.transform(
          { quantity, reason: 'Delivery', requestId },
          { type: 'body', metatype: ReceiveInventoryDto },
        ),
      ).rejects.toThrow();
    },
  );

  it.each([-2147483648, -1, 1, 2147483647])(
    'accepts bounded signed adjustment %s',
    async (quantityChange) => {
      await expect(
        pipe.transform(
          { quantityChange, reason: ' Correction ', requestId },
          { type: 'body', metatype: AdjustInventoryDto },
        ),
      ).resolves.toMatchObject({ quantityChange, reason: 'Correction' });
    },
  );

  it.each([0, -2147483649, 2147483648, 0.5, '2'])(
    'rejects adjustment %s',
    async (quantityChange) => {
      await expect(
        pipe.transform(
          { quantityChange, reason: 'Correction', requestId },
          { type: 'body', metatype: AdjustInventoryDto },
        ),
      ).rejects.toThrow();
    },
  );

  it.each([
    { reason: ' ' },
    { reason: 'x'.repeat(501) },
    { requestId: 'not-a-uuid' },
    { createdById: requestId },
    { organizationId: requestId },
    { quantityChange: 1 },
  ])('rejects invalid or untrusted receipt fields %j', async (extra) => {
    await expect(
      pipe.transform(
        { quantity: 1, reason: 'Delivery', requestId, ...extra },
        { type: 'body', metatype: ReceiveInventoryDto },
      ),
    ).rejects.toThrow();
  });
});
