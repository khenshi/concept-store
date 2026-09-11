import { merchantFormSchema, merchantResponseSchema } from './merchant.schemas';

describe('merchant schemas', () => {
  it('normalizes valid form values and accepts Philippine mobile and landline numbers', () => {
    expect(
      merchantFormSchema.parse({
        name: ' Amihan Home Studio ',
        code: ' amihan-home ',
        contactName: ' Mara Santos ',
        email: ' MARA@AMIHAN.EXAMPLE.COM ',
        phone: '+63 917 555 0101',
      }),
    ).toEqual({
      name: 'Amihan Home Studio',
      code: 'AMIHAN-HOME',
      contactName: 'Mara Santos',
      email: 'mara@amihan.example.com',
      phone: '+63 917 555 0101',
    });
    expect(
      merchantFormSchema.safeParse({
        name: 'Valid Merchant',
        code: '',
        contactName: 'Valid Contact',
        email: '',
        phone: '(02) 8555 0102',
      }).success,
    ).toBe(true);
  });

  it('rejects foreign and incomplete phone numbers', () => {
    for (const phone of ['+1 212 555 0101', '0917', 'not a number']) {
      expect(
        merchantFormSchema.safeParse({
          name: 'Valid Merchant',
          code: '',
          contactName: 'Valid Contact',
          email: '',
          phone,
        }).success,
      ).toBe(false);
    }
  });

  it('validates the server response contract', () => {
    expect(() =>
      merchantResponseSchema.parse({
        id: 'not-a-uuid',
        organizationId: 'also-invalid',
        status: 'ARCHIVED',
      }),
    ).toThrow();
  });
});
