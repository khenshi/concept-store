import {
  activeSessionPageSchema,
  loginSchema,
  newPasswordSchema,
  registrationSchema,
} from './auth.schemas';

describe('new password byte policy', () => {
  it.each([
    ['a'.repeat(71), true],
    ['a'.repeat(72), true],
    ['a'.repeat(73), false],
    ['😀'.repeat(6), false],
    ['😀'.repeat(12), true],
    ['é'.repeat(36), true],
    ['é'.repeat(36) + 'a', false],
    ['😀'.repeat(18), true],
    ['😀'.repeat(18) + 'a', false],
    [null, false],
    [42, false],
  ])(
    'validates UTF-8 boundaries without truncation (%s)',
    (password, valid) => {
      expect(newPasswordSchema.safeParse(password).success).toBe(valid);
    },
  );
  it('preserves spaces and rejects a shared-prefix suffix instead of truncating', () => {
    const password = ' ' + 'a'.repeat(70) + ' ';
    expect(newPasswordSchema.parse(password)).toBe(password);
    expect(newPasswordSchema.safeParse(password + 'suffix').success).toBe(
      false,
    );
    expect(
      loginSchema.safeParse({
        email: 'owner@example.com',
        password: 'é'.repeat(64),
      }).success,
    ).toBe(true);
    expect(
      registrationSchema.safeParse({
        firstName: 'Ari',
        lastName: 'Mendoza',
        email: 'owner@example.com',
        password: 'a'.repeat(73),
      }).success,
    ).toBe(false);
  });
});

describe('strict active session page schema', () => {
  const item = {
    id: '00000000-0000-4000-8000-000000000001',
    isCurrent: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    expiresAt: '2026-11-01T00:00:00.000Z',
  };
  const page = {
    items: [item],
    page: 1,
    pageSize: 15,
    total: 1,
    totalPages: 1,
  };
  it('accepts bounded session metadata and empty/out-of-range pages', () => {
    expect(activeSessionPageSchema.parse(page)).toEqual(page);
    expect(
      activeSessionPageSchema.safeParse({
        ...page,
        items: [],
        total: 0,
        totalPages: 0,
      }).success,
    ).toBe(true);
    expect(
      activeSessionPageSchema.safeParse({ ...page, items: [], page: 2 })
        .success,
    ).toBe(true);
  });
  it.each([
    { refreshToken: 'secret' },
    { pageSize: 20 },
    { page: '1' },
    { totalPages: 5 },
    { items: [{ ...item, refreshTokenHash: 'secret' }] },
    { items: [{ ...item, isCurrent: 'true' }] },
    { items: [{ ...item, id: 'invalid' }] },
    { items: [{ ...item, createdAt: 'yesterday' }] },
    { items: [] },
    { items: [item, item], total: 2 },
  ])('rejects malformed or extra response data %j', (override) => {
    expect(
      activeSessionPageSchema.safeParse({ ...page, ...override }).success,
    ).toBe(false);
  });
});

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
