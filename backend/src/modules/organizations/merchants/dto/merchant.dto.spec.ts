import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MerchantStatus } from '../../../../generated/prisma/client';
import { CreateMerchantDto } from './create-merchant.dto';
import { ListMerchantsQueryDto } from './list-merchants-query.dto';
import { UpdateMerchantStatusDto } from './update-merchant-status.dto';
import { UpdateMerchantDto } from './update-merchant.dto';

describe('Merchant DTOs', () => {
  it('normalizes a merchant profile on create', async () => {
    const dto = plainToInstance(CreateMerchantDto, {
      name: '  Amihan Home Studio ',
      code: ' amihan-home ',
      contactName: ' Mara Santos ',
      email: ' MARA@AMIHAN.EXAMPLE.COM ',
      phone: ' +63 917 555 0101 ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toEqual({
      name: 'Amihan Home Studio',
      code: 'AMIHAN-HOME',
      contactName: 'Mara Santos',
      email: 'mara@amihan.example.com',
      phone: '+63 917 555 0101',
    });
  });

  it('permits clearing optional profile fields but rejects null required fields', async () => {
    const clearable = plainToInstance(UpdateMerchantDto, {
      code: '',
      email: null,
    });
    const invalid = plainToInstance(UpdateMerchantDto, { contactName: null });

    await expect(validate(clearable)).resolves.toHaveLength(0);
    expect(clearable).toMatchObject({ code: null, email: null });
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
  });

  it('validates code, email, phone, and lifecycle status values', async () => {
    const invalidCreate = plainToInstance(CreateMerchantDto, {
      name: 'Valid Name',
      code: 'INVALID CODE',
      contactName: 'Valid Contact',
      email: 'not-an-email',
      phone: '123',
    });
    const invalidStatus = plainToInstance(UpdateMerchantStatusDto, {
      status: 'ARCHIVED',
    });

    await expect(validate(invalidCreate)).resolves.toHaveLength(3);
    await expect(validate(invalidStatus)).resolves.toHaveLength(1);
  });

  it('normalizes search and validates an exact status filter', async () => {
    const query = plainToInstance(ListMerchantsQueryDto, {
      q: '  Amihan ',
      status: MerchantStatus.ACTIVE,
    });

    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query).toEqual({ q: 'Amihan', status: MerchantStatus.ACTIVE });
  });
});
