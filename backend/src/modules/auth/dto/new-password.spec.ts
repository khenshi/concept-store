import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { compare, hash } from 'bcryptjs';
import { RegisterDto } from './register.dto';
import { ChangePasswordDto } from './change-password.dto';
import { DeleteAccountDto } from './delete-account.dto';
import { LoginDto } from './login.dto';
import { assertNewPassword } from './new-password';

describe('New password policy', () => {
  it.each(['a'.repeat(71), 'a'.repeat(72), 'é'.repeat(36), '😀'.repeat(18)])(
    'accepts the UTF-8 byte boundary %p',
    async (password) => {
      expect(() => assertNewPassword(password)).not.toThrow();
      expect(
        await validate(
          plainToInstance(ChangePasswordDto, {
            currentPassword: 'old password',
            newPassword: password,
          }),
        ),
      ).toHaveLength(0);
    },
  );

  it.each([
    'a'.repeat(73),
    'é'.repeat(36) + 'a',
    '😀'.repeat(19),
    'short',
    null,
    123,
    undefined,
  ])(
    'rejects invalid new secrets %p in service policy and both DTOs',
    async (password) => {
      expect(() => assertNewPassword(password)).toThrow();
      const registration = plainToInstance(RegisterDto, {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.test',
        password,
      });
      if (password !== undefined) {
        expect(
          (await validate(registration)).some(
            (error) => error.property === 'password',
          ),
        ).toBe(true);
      }
      expect(
        (
          await validate(
            plainToInstance(ChangePasswordDto, {
              currentPassword: 'old password',
              newPassword: password,
            }),
          )
        ).some((error) => error.property === 'newPassword'),
      ).toBe(true);
    },
  );

  it('preserves legacy bcrypt login/current/deletion input compatibility', async () => {
    const password = 'a'.repeat(72) + 'old suffix';
    const legacyHash = await hash(password, 4);
    expect(await compare('a'.repeat(72) + 'other suffix', legacyHash)).toBe(
      true,
    );
    expect(
      await validate(
        plainToInstance(LoginDto, { email: 'test@example.test', password }),
      ),
    ).toHaveLength(0);
    expect(
      await validate(plainToInstance(DeleteAccountDto, { password })),
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(ChangePasswordDto, {
          currentPassword: password,
          newPassword: 'a different password',
        }),
      ),
    ).toHaveLength(0);
  });

  it('keeps whitespace as part of a secret', () => {
    expect(() => assertNewPassword(' '.repeat(12))).not.toThrow();
  });
});
