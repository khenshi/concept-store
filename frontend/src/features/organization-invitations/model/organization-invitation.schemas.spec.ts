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
  it('requires a merchant link only for MERCHANT and rejects duplicate/oversized branch selections', () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const input = { email: 'merchant@example.test', role: 'MERCHANT' };
    expect(createOrganizationInvitationSchema.safeParse(input).success).toBe(
      false,
    );
    expect(
      createOrganizationInvitationSchema.safeParse({
        ...input,
        merchantId: id,
        branchIds: [id],
      }).success,
    ).toBe(true);
    expect(
      createOrganizationInvitationSchema.safeParse({
        ...input,
        role: 'CASHIER',
        merchantId: id,
      }).success,
    ).toBe(false);
    expect(
      createOrganizationInvitationSchema.safeParse({
        ...input,
        merchantId: id,
        branchIds: [id, id],
      }).success,
    ).toBe(false);
    expect(
      createOrganizationInvitationSchema.safeParse({
        ...input,
        merchantId: id,
        branchIds: Array(101).fill(id),
      }).success,
    ).toBe(false);
  });
});
