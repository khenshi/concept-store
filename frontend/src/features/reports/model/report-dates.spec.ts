import {
  reportDateRangeSchema,
  reportUtcRange,
  todayInPhilippines,
} from './report-dates';

describe('Philippines report dates', () => {
  it('changes today at Philippines midnight, not UTC midnight', () => {
    expect(todayInPhilippines(new Date('2026-09-13T15:59:59Z')).fromDay).toBe(
      '2026-09-13',
    );
    expect(todayInPhilippines(new Date('2026-09-13T16:00:00Z'))).toEqual({
      fromDay: '2026-09-14',
      throughDay: '2026-09-14',
    });
  });
  it('converts inclusive calendar dates to a half-open UTC range', () => {
    expect(
      reportUtcRange({ fromDay: '2026-09-14', throughDay: '2026-09-14' }),
    ).toEqual({
      from: '2026-09-13T16:00:00.000Z',
      until: '2026-09-14T16:00:00.000Z',
    });
    expect(
      reportUtcRange({ fromDay: '2024-02-28', throughDay: '2024-02-29' }).until,
    ).toBe('2024-02-29T16:00:00.000Z');
  });
  it('allows exactly 366 inclusive days but not 367', () => {
    expect(
      reportDateRangeSchema.safeParse({
        fromDay: '2024-01-01',
        throughDay: '2024-12-31',
      }).success,
    ).toBe(true);
    expect(
      reportDateRangeSchema.safeParse({
        fromDay: '2024-01-01',
        throughDay: '2025-01-01',
      }).success,
    ).toBe(false);
  });
  it.each(['', '2026-02-29', '2026-04-31', '14/09/2026', '0000-01-01'])(
    'rejects invalid date %s',
    (fromDay) => {
      expect(
        reportDateRangeSchema.safeParse({ fromDay, throughDay: '2026-09-14' })
          .success,
      ).toBe(false);
    },
  );
  it('rejects reversed dates and unknown fields without choosing another period', () => {
    expect(() =>
      reportUtcRange({ fromDay: '2026-09-15', throughDay: '2026-09-14' }),
    ).toThrow();
    expect(
      reportDateRangeSchema.safeParse({
        fromDay: '2026-09-14',
        throughDay: '2026-09-14',
        timezone: 'UTC',
      }).success,
    ).toBe(false);
  });
});
