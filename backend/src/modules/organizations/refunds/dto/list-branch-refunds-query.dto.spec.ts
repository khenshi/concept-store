import { ValidationPipe } from '@nestjs/common';
import { ListBranchRefundsQueryDto } from './list-branch-refunds-query.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const parse = (query: Record<string, unknown>) =>
  pipe.transform(query, { type: 'query', metatype: ListBranchRefundsQueryDto });

describe('Branch refund query UTC calendar validation', () => {
  it.each([
    '0001-01-01T00:00:00Z',
    '0099-12-31T23:59:59.999Z',
    '0100-01-01T00:00:00Z',
    '0004-02-29T00:00:00Z',
    '2000-02-29T00:00:00.1Z',
    '9999-12-30T23:59:59.99Z',
  ])(
    'accepts valid four-digit UTC dates including early years %s',
    async (from) => {
      await expect(
        parse({ from, until: '9999-12-31T23:59:59.999Z' }),
      ).resolves.toMatchObject({ from, page: 1, limit: 15 });
    },
  );
  it.each([
    null,
    '',
    '0000-01-01T00:00:00Z',
    '0001-02-29T00:00:00Z',
    '1900-02-29T00:00:00Z',
    '2026-02-30T00:00:00Z',
    '2026-13-01T00:00:00Z',
    '2026-10-21T24:00:00Z',
    '2026-10-21T00:00:60Z',
    '2026-10-21T00:00:00z',
    '2026-10-21T00:00:00+00:00',
    '+010000-01-01T00:00:00Z',
    '2026-10-21T00:00:00.1234Z',
  ])('rejects invalid calendar or unsupported UTC values %j', async (from) => {
    await expect(
      parse({ from, until: '9999-12-31T23:59:59.999Z' }),
    ).rejects.toThrow();
    await expect(
      parse({ from: '0001-01-01T00:00:00Z', until: from }),
    ).rejects.toThrow();
  });
  it('requires both bounds together and keeps omitted dates absent', async () => {
    await expect(parse({ from: '2026-10-21T00:00:00Z' })).rejects.toThrow();
    await expect(parse({ until: '2026-10-22T00:00:00Z' })).rejects.toThrow();
    await expect(parse({ q: '   ' })).resolves.toMatchObject({
      page: 1,
      limit: 15,
      q: undefined,
    });
    const query = (await parse({})) as ListBranchRefundsQueryDto;
    expect(query.from).toBeUndefined();
    expect(query.until).toBeUndefined();
  });
});
