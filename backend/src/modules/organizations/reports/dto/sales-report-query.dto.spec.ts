import { ValidationPipe } from '@nestjs/common';
import {
  ReportBranchesQueryDto,
  SalesReportQueryDto,
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
});
