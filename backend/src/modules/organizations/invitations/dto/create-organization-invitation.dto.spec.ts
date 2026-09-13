import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrganizationInvitationDto } from './create-organization-invitation.dto';

describe('Invitation access grant validation', () => {
  const id = 'cad19536-c64f-4595-9529-40e1f6b0523e';
  const check = (data: object) =>
    validate(plainToInstance(CreateOrganizationInvitationDto, data), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
  it('accepts normalized email and distinct branch grants with merchant link', async () => {
    expect(
      await check({
        email: ' merchant@example.test ',
        role: 'MERCHANT',
        merchantId: id,
        branchIds: [id],
      }),
    ).toEqual([]);
  });
  it.each([
    { branchIds: [id, id] },
    { branchIds: null },
    { branchIds: ['bad'] },
    { branchIds: Array.from({ length: 101 }, () => id) },
    { merchantId: null },
    { merchantId: 'bad' },
    { organizationId: id },
  ])('rejects invalid or unknown grants %j', async (extra) => {
    expect(
      (await check({ email: 'member@example.test', role: 'MANAGER', ...extra }))
        .length,
    ).toBeGreaterThan(0);
  });
  it('requires a merchant UUID for merchant invitations', async () => {
    expect(
      (await check({ email: 'member@example.test', role: 'MERCHANT' })).length,
    ).toBeGreaterThan(0);
  });
});
