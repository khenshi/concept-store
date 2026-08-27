import { updateProfileSchema } from './account.schemas';

describe('update profile schema', () => {
  it('trims personal details and normalizes an empty phone', () => {
    expect(
      updateProfileSchema.parse({
        firstName: '  Maria ',
        lastName: ' Santos  ',
        phone: ' ',
      }),
    ).toEqual({ firstName: 'Maria', lastName: 'Santos', phone: undefined });
  });

  it('requires both names', () => {
    expect(
      updateProfileSchema.safeParse({ firstName: '', lastName: '' }).success,
    ).toBe(false);
  });
});
