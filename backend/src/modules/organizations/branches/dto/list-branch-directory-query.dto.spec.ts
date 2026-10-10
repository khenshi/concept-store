import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { BranchStatus } from '../../../../generated/prisma/client';
import { ListBranchDirectoryQueryDto } from './list-branch-directory-query.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

const validate = (query: unknown) =>
  pipe.transform(query, {
    type: 'query',
    metatype: ListBranchDirectoryQueryDto,
  });

describe('Branch directory query validation', () => {
  it('trims search and defaults to the first fixed-size page', async () => {
    await expect(
      validate({ q: '  Makati  ', status: 'INACTIVE' }),
    ).resolves.toMatchObject({
      q: 'Makati',
      status: BranchStatus.INACTIVE,
      page: 1,
    });
  });

  it('rejects invalid status, page, and unknown fields', async () => {
    await expect(validate({ status: 'ARCHIVED' })).rejects.toThrow();
    await expect(validate({ page: '0' })).rejects.toThrow();
    await expect(validate({ unexpected: 'value' })).rejects.toThrow();
  });

  it('transforms numeric page values', () => {
    expect(
      plainToInstance(ListBranchDirectoryQueryDto, { page: '2' }).page,
    ).toBe(2);
  });
});
