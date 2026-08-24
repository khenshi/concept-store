import { merchantSchema } from './merchant.schemas';

describe('merchant schema', () => {
  it('normalizes a complete merchant profile', () => {
    expect(
      merchantSchema.parse({
        name: '  Amihan Goods ',
        code: ' amihan-01 ',
        contactName: ' Maria Santos ',
        email: ' MARIA@AMIHAN.EXAMPLE ',
        phone: ' +63 917 123 4567 ',
      }),
    ).toEqual({
      name: 'Amihan Goods',
      code: 'AMIHAN-01',
      contactName: 'Maria Santos',
      email: 'maria@amihan.example',
      phone: '+63 917 123 4567',
    });
  });

  it('requires valid contact details', () => {
    expect(
      merchantSchema.safeParse({
        name: 'Amihan Goods',
        code: '',
        contactName: '',
        email: 'invalid',
        phone: '123',
      }).success,
    ).toBe(false);
  });
});
