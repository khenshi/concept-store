import { branchSchema } from './branch.schemas';

describe('branch schema', () => {
  it('normalizes a valid branch form', () => {
    expect(
      branchSchema.parse({
        name: '  Makati Main ',
        code: ' mkt-01 ',
        addressLine1: ' 123 Retail Street ',
        addressLine2: '',
        city: ' Makati ',
        province: ' Metro Manila ',
        postalCode: '',
        countryCode: ' ph ',
      }),
    ).toEqual({
      name: 'Makati Main',
      code: 'MKT-01',
      addressLine1: '123 Retail Street',
      addressLine2: undefined,
      city: 'Makati',
      province: 'Metro Manila',
      postalCode: undefined,
      countryCode: 'PH',
    });
  });

  it('rejects an incomplete physical address', () => {
    expect(
      branchSchema.safeParse({
        name: 'Makati Main',
        code: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        province: '',
        postalCode: '',
        countryCode: 'PH',
      }).success,
    ).toBe(false);
  });
});
