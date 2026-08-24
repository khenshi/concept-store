import { addOrganizationMemberSchema } from './organization-member.schemas';

describe('add organization member schema', () => {
  it('normalizes a valid email and accepts an organization role', () => {
    expect(
      addOrganizationMemberSchema.parse({
        email: '  MANAGER@Example.com ',
        role: 'MANAGER',
      }),
    ).toEqual({ email: 'manager@example.com', role: 'MANAGER' });
  });

  it('rejects invalid email and role values', () => {
    expect(
      addOrganizationMemberSchema.safeParse({
        email: 'not-an-email',
        role: 'SUPERADMIN',
      }).success,
    ).toBe(false);
  });
});
