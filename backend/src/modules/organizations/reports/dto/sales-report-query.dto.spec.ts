import { ValidationPipe } from '@nestjs/common';
import {
  ReportBranchesQueryDto,
  SalesRankingQueryDto,
  SalesReportQueryDto,
  TransactionsQueryDto,
} from './sales-report-query.dto';
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const valid = {
  from: '2026-09-01T00:00:00Z',
  until: '2026-09-02T00:00:00.123Z',
};
describe('Report query validation', () => {
  it('trims required UTC timestamps without losing milliseconds', async () => {
    await expect(
      pipe.transform(
        { from: ` ${valid.from} `, until: valid.until },
        { type: 'query', metatype: SalesReportQueryDto },
      ),
    ).resolves.toMatchObject(valid);
  });
  it.each([
    {},
    { from: valid.from },
    { until: valid.until },
    { ...valid, from: null },
    { ...valid, from: '2026-02-30T00:00:00Z' },
    { ...valid, from: '2026-09-01' },
    { ...valid, until: '2026-09-02T08:00:00+08:00' },
    { ...valid, until: '2026-09-02T00:00:00.1234Z' },
    { ...valid, page: '1' },
    { ...valid, merchantId: 'guessed' },
    { ...valid, role: 'OWNER' },
  ])('rejects malformed/missing/unknown summary query %j', async (query) => {
    await expect(
      pipe.transform(query, { type: 'query', metatype: SalesReportQueryDto }),
    ).rejects.toThrow();
  });
  it('rejects every branch-lookup query field', async () => {
    await expect(
      pipe.transform(
        { from: valid.from },
        { type: 'query', metatype: ReportBranchesQueryDto },
      ),
    ).rejects.toThrow();
  });
  it('defaults ranking pages and gross ordering, and rejects invalid ranking fields', async () => {
    await expect(
      pipe.transform(valid, {
        type: 'query',
        metatype: SalesRankingQueryDto,
      }),
    ).resolves.toMatchObject({
      ...valid,
      page: 1,
      sortBy: 'GROSS_SALES',
    });
    await expect(
      pipe.transform(
        { ...valid, page: '2' },
        { type: 'query', metatype: SalesRankingQueryDto },
      ),
    ).resolves.toMatchObject({ ...valid, page: 2 });
    await expect(
      pipe.transform(
        {
          ...valid,
          sortBy: 'UNITS_SOLD',
          merchantId: '11111111-1111-4111-8111-111111111111',
        },
        { type: 'query', metatype: SalesRankingQueryDto },
      ),
    ).resolves.toMatchObject({
      ...valid,
      page: 1,
      sortBy: 'UNITS_SOLD',
      merchantId: '11111111-1111-4111-8111-111111111111',
    });
    for (const page of ['0', '21474837', '1.5', 'nope']) {
      await expect(
        pipe.transform(
          { ...valid, page },
          { type: 'query', metatype: SalesRankingQueryDto },
        ),
      ).rejects.toThrow();
    }
    for (const sortBy of ['grossSales', 'UNITS', '']) {
      await expect(
        pipe.transform(
          { ...valid, sortBy },
          { type: 'query', metatype: SalesRankingQueryDto },
        ),
      ).rejects.toThrow();
    }
    await expect(
      pipe.transform(
        { ...valid, merchantId: 'foreign' },
        { type: 'query', metatype: SalesRankingQueryDto },
      ),
    ).rejects.toThrow();
  });
  it('defaults transaction pagination and validates type/search filters', async () => {
    await expect(
      pipe.transform(
        { ...valid, type: 'REFUND', q: ' REF-12 ' },
        { type: 'query', metatype: TransactionsQueryDto },
      ),
    ).resolves.toMatchObject({
      ...valid,
      type: 'REFUND',
      q: 'REF-12',
      page: 1,
      limit: 50,
    });
    for (const input of [
      { ...valid, type: 'ALL' },
      { ...valid, page: '0' },
      { ...valid, limit: '101' },
      { ...valid, q: 'x'.repeat(255) },
      { ...valid, unknown: 'field' },
    ]) {
      await expect(
        pipe.transform(input, {
          type: 'query',
          metatype: TransactionsQueryDto,
        }),
      ).rejects.toThrow();
    }
  });
});
