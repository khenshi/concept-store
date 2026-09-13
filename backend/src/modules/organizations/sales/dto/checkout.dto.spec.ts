import { ValidationPipe } from '@nestjs/common';
import { CheckoutDto } from './checkout.dto';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const command = {
  requestId: id,
  items: [{ branchInventoryId: id, quantity: 1, expectedUnitPrice: '12.50' }],
  paymentMethod: 'CASH',
  cashTender: '20.00',
};
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const validate = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: CheckoutDto });
describe('Checkout command validation', () => {
  it('normalizes identifiers and trims cash values without numeric coercion', async () => {
    await expect(
      validate({
        ...command,
        requestId: id.toUpperCase(),
        cashTender: ' 20.00 ',
      }),
    ).resolves.toMatchObject(command);
  });
  it.each(['GCASH', 'CARD'])(
    'accepts a trimmed manual %s reference',
    async (paymentMethod) => {
      const { cashTender, ...noncash } = command;
      expect(cashTender).toBe('20.00');
      await expect(
        validate({
          ...noncash,
          paymentMethod,
          paymentReference: ' reference ',
        }),
      ).resolves.toMatchObject({ paymentReference: 'reference' });
    },
  );
  it.each([
    { cashTender: 20 },
    { cashTender: null },
    { cashTender: '1e3' },
    { cashTender: '-1' },
    { cashTender: '1.001' },
    { cashTender: '1'.repeat(23) },
    { paymentReference: null },
    { paymentReference: 'unwanted' },
    { total: '12.50' },
    { createdById: id },
    { requestId: 'bad' },
    { paymentMethod: 'OTHER' },
    { items: [] },
    { items: Array(101).fill(command.items[0]) },
    {
      items: [
        command.items[0],
        { ...command.items[0], branchInventoryId: id.toUpperCase() },
      ],
    },
    { items: [{ ...command.items[0], quantity: 0 }] },
    { items: [{ ...command.items[0], quantity: -1 }] },
    { items: [{ ...command.items[0], quantity: '1' }] },
    { items: [{ ...command.items[0], quantity: 1.5 }] },
    { items: [{ ...command.items[0], quantity: 2147483648 }] },
    { items: [{ ...command.items[0], expectedUnitPrice: '0' }] },
    { items: [{ ...command.items[0], expectedUnitPrice: 12.5 }] },
    { items: [{ ...command.items[0], expectedUnitPrice: '1e2' }] },
    { items: [{ ...command.items[0], merchantId: id }] },
    { items: [null] },
    { items: 'bad' },
  ])('rejects invalid/untrusted command %j', async (extra) => {
    await expect(validate({ ...command, ...extra })).rejects.toThrow();
  });
  it.each([undefined, null, '', 'x', 'x'.repeat(101), 123])(
    'rejects invalid noncash reference %j',
    async (paymentReference) => {
      await expect(
        validate({
          requestId: id,
          items: command.items,
          paymentMethod: 'GCASH',
          paymentReference,
        }),
      ).rejects.toThrow();
    },
  );
  it.each([null, '20.00'])(
    'rejects noncash tender even if %j',
    async (cashTender) => {
      await expect(
        validate({
          ...command,
          paymentMethod: 'CARD',
          paymentReference: 'reference',
          cashTender,
        }),
      ).rejects.toThrow();
    },
  );
});
