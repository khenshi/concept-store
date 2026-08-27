import { createOrganizationInvitationSchema } from './organization-invitation.schemas';

describe('create organization invitation schema', () => {
  it('normalizes a valid email and accepts an invitational role', () => {
    expect(
      createOrganizationInvitationSchema.parse({
        email: '  MANAGER@Example.com ',
        role: 'MANAGER',
      }),
    ).toEqual({ email: 'manager@example.com', role: 'MANAGER' });
  });

  it('rejects invalid emails and roles that cannot be invited', () => {
    expect(
      createOrganizationInvitationSchema.safeParse({
        email: 'not-an-email',
        role: 'OWNER',
      }).success,
    ).toBe(false);
  });
});
