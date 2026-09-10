import { loginSchema, registrationSchema } from './auth.schemas';

describe('authentication form schemas', () => {
  it('allows login with any non-empty existing password', () => {
    expect(
      loginSchema.safeParse({ email: 'owner@example.com', password: 'legacy' })
        .success,
    ).toBe(true);
  });

  it('rejects registration passwords shorter than twelve characters', () => {
    const result = registrationSchema.safeParse({
      firstName: 'Maria',
      lastName: 'Santos',
      phone: '',
      email: 'owner@example.com',
      password: 'too-short',
    });

    expect(result.success).toBe(false);
  });

  it('normalizes email validation errors for the form', () => {
    const result = registrationSchema.safeParse({
      firstName: 'Maria',
      lastName: 'Santos',
      phone: '',
      email: 'not-an-email',
      password: 'a-secure-password',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toContain(
        'Enter a valid email address.',
      );
    }
  });

  it('requires personal names and normalizes an empty optional phone', () => {
    expect(
      registrationSchema.safeParse({
        firstName: '  Maria ',
        lastName: ' Santos ',
        phone: '',
        email: 'owner@example.com',
        password: 'a-secure-password',
      }),
    ).toMatchObject({
      success: true,
      data: {
        firstName: 'Maria',
        lastName: 'Santos',
        phone: undefined,
      },
    });
  });
});
