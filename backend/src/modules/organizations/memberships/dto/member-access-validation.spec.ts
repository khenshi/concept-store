import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateOrganizationMemberRoleDto } from './update-organization-member-role.dto';
import {
  EmptyAssignmentDto,
  UpdateMemberMerchantDto,
} from './update-member-merchant.dto';

describe('Member access DTOs', () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const options = {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: false,
  };
  it('requires merchant UUID on merchant role commands', async () => {
    expect(
      await validate(
        plainToInstance(UpdateOrganizationMemberRoleDto, {
          role: 'MERCHANT',
          merchantId: id,
        }),
        options,
      ),
    ).toEqual([]);
    expect(
      (
        await validate(
          plainToInstance(UpdateOrganizationMemberRoleDto, {
            role: 'MERCHANT',
          }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('rejects malformed and null merchant links and unknown fields', async () => {
    for (const data of [
      { merchantId: null },
      { merchantId: 'bad' },
      { merchantId: id, organizationId: id },
    ]) {
      expect(
        (
          await validate(
            plainToInstance(UpdateMemberMerchantDto, data),
            options,
          )
        ).length,
      ).toBeGreaterThan(0);
    }
  });
  it('rejects all fields in branch assignment bodies', async () => {
    expect(
      await validate(plainToInstance(EmptyAssignmentDto, {}), options),
    ).toEqual([]);
    expect(
      (
        await validate(
          plainToInstance(EmptyAssignmentDto, { role: 'OWNER' }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
