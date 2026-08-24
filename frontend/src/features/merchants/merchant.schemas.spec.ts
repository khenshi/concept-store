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
        branchIds: ['6b109a2f-142c-4af4-93d8-12941d0685ac'],
      }),
    ).toEqual({
      name: 'Amihan Goods',
      code: 'AMIHAN-01',
      contactName: 'Maria Santos',
      email: 'maria@amihan.example',
      phone: '+63 917 123 4567',
      branchIds: ['6b109a2f-142c-4af4-93d8-12941d0685ac'],
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
        branchIds: [],
      }).success,
    ).toBe(false);
  });
});
