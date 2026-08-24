import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMerchantDto } from './create-merchant.dto';
import { UpdateMerchantDto } from './update-merchant.dto';

describe('merchant DTOs', () => {
  it('normalizes required profile and contact fields', async () => {
    const dto = plainToInstance(CreateMerchantDto, {
      name: '  Amihan Goods  ',
      code: ' amihan-01 ',
      contactName: '  Maria Santos  ',
      email: '  MARIA@AMIHAN.EXAMPLE  ',
      phone: '  +63 917 123 4567  ',
      branchIds: ['6b109a2f-142c-4af4-93d8-12941d0685ac'],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toEqual({
      name: 'Amihan Goods',
      code: 'AMIHAN-01',
      contactName: 'Maria Santos',
      email: 'maria@amihan.example',
      phone: '+63 917 123 4567',
      branchIds: ['6b109a2f-142c-4af4-93d8-12941d0685ac'],
    });
  });

  it('requires all merchant contact fields when creating', async () => {
    const dto = plainToInstance(CreateMerchantDto, {
      name: 'Amihan Goods',
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['contactName', 'email', 'phone', 'branchIds']),
    );
  });

  it('permits clearing only the optional merchant code when updating', async () => {
    const dto = plainToInstance(UpdateMerchantDto, {
      code: '',
      contactName: null,
    });

    const errors = await validate(dto);
    expect(dto.code).toBeNull();
    expect(errors.map((error) => error.property)).toContain('contactName');
  });
});
