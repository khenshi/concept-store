import {
  changePasswordSchema,
  deleteAccountSchema,
  updateProfileSchema,
} from './account.schemas';

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

describe('delete account schema', () => {
  it('requires a password confirmation', () => {
    expect(deleteAccountSchema.safeParse({ password: '' }).success).toBe(false);
    expect(
      deleteAccountSchema.safeParse({ password: 'current password' }).success,
    ).toBe(true);
  });
});

describe('change password schema', () => {
  it('accepts a confirmed new password', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'current secure password',
        newPassword: 'different secure password',
        confirmPassword: 'different secure password',
      }).success,
    ).toBe(true);
  });

  it('rejects mismatched and reused passwords', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'current secure password',
        newPassword: 'current secure password',
        confirmPassword: 'different secure password',
      }).success,
    ).toBe(false);
  });
});
