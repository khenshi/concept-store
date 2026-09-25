import { salesDateRangeSchema, salesUtcRange } from './sales-date-range';

describe('staff sales Manila date filters', () => {
  it('converts inclusive calendar days to Manila UTC boundaries', () => {
    expect(
      salesUtcRange({ fromDay: '2026-09-13', throughDay: '2026-09-13' }),
    ).toEqual({
      from: '2026-09-12T16:00:00.000Z',
      until: '2026-09-13T16:00:00.000Z',
    });
  });
  it('keeps optional one-sided bounds and rejects reversed dates', () => {
    expect(salesUtcRange({ fromDay: '2026-09-13' })).toEqual({
      from: '2026-09-12T16:00:00.000Z',
    });
    expect(salesUtcRange({ throughDay: '2026-09-13' })).toEqual({
      until: '2026-09-13T16:00:00.000Z',
    });
    expect(
      salesDateRangeSchema.safeParse({
        fromDay: '2026-09-14',
        throughDay: '2026-09-13',
      }).success,
    ).toBe(false);
    expect(
      salesDateRangeSchema.safeParse({
        fromDay: '2026-02-30',
        throughDay: '',
      }).success,
    ).toBe(false);
  });
});
