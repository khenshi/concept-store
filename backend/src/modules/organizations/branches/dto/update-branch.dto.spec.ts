import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateBranchDto } from './update-branch.dto';

describe('UpdateBranchDto', () => {
  it('normalizes codes and permits clearing nullable fields', async () => {
    const dto = plainToInstance(UpdateBranchDto, {
      code: ' mkt-01 ',
      addressLine2: '',
      postalCode: null,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      code: 'MKT-01',
      addressLine2: null,
      postalCode: null,
    });
  });

  it('rejects null for a required address field when it is supplied', async () => {
    const dto = plainToInstance(UpdateBranchDto, { city: null });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
