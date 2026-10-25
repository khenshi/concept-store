import {
  changePasswordSchema,
  deleteAccountSchema,
  sanitizePhilippinePhoneInput,
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

  it('sanitizes phone input without changing its allowed formatting', () => {
    expect(sanitizePhilippinePhoneInput('+63 917 ABC 1234 ext. 5')).toBe(
      '+63 917  1234  5',
    );
    expect(sanitizePhilippinePhoneInput('09+17-123-4567')).toBe(
      '0917-123-4567',
    );
    expect(sanitizePhilippinePhoneInput('091712345678999')).toBe('09171234567');
    expect(sanitizePhilippinePhoneInput('+6391712345678999')).toBe(
      '+639171234567',
    );
  });

  it.each(['0917 123 4567', '+63 917 123 4567', '(02) 8123-4567'])(
    'accepts valid Philippine phone number format: %s',
    (phone) => {
      expect(
        updateProfileSchema.safeParse({
          firstName: 'Maria',
          lastName: 'Santos',
          phone,
        }).success,
      ).toBe(true);
    },
  );

  it.each(['1234567890', '+1 917 123 4567', '0917 ABC 4567'])(
    'rejects invalid Philippine phone number format: %s',
    (phone) => {
      expect(
        updateProfileSchema.safeParse({
          firstName: 'Maria',
          lastName: 'Santos',
          phone,
        }).success,
      ).toBe(false);
    },
  );

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
  it('limits only new passwords by UTF-8 bytes, preserving legacy current/deletion inputs', () => {
    const currentPassword = 'é'.repeat(64);
    const newPassword = '😀'.repeat(18);
    expect(
      changePasswordSchema.safeParse({
        currentPassword,
        newPassword,
        confirmPassword: newPassword,
      }).success,
    ).toBe(true);
    expect(
      deleteAccountSchema.safeParse({ password: currentPassword }).success,
    ).toBe(true);
    expect(
      changePasswordSchema.safeParse({
        currentPassword,
        newPassword: newPassword + 'a',
        confirmPassword: newPassword + 'a',
      }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: newPassword,
        newPassword,
        confirmPassword: newPassword,
      }).success,
    ).toBe(false);
  });
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
