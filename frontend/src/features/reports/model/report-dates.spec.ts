import {
  reportDateRangeSchema,
  reportUtcRange,
  todayInPhilippines,
  reportPresetDates,
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
  it('allows multi-year custom periods', () => {
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
    ).toBe(true);
  });
  it.each([
    ['THIS_MONTH', '2026-09-01'],
    ['LAST_30_DAYS', '2026-08-16'],
    ['THIS_YEAR', '2026-01-01'],
    ['LAST_12_MONTHS', '2025-09-15'],
    ['LAST_2_YEARS', '2024-09-15'],
  ] as const)(
    'resolves %s backward through Philippine today',
    (preset, fromDay) => {
      expect(
        reportPresetDates(preset, new Date('2026-09-14T00:00:00Z')),
      ).toEqual({ fromDay, throughDay: '2026-09-14' });
    },
  );
  it('clamps rolling leap-day boundaries and crosses month ends', () => {
    expect(
      reportPresetDates('LAST_12_MONTHS', new Date('2024-02-28T00:00:00Z'))
        .fromDay,
    ).toBe('2023-02-28');
    expect(
      reportPresetDates('LAST_12_MONTHS', new Date('2024-02-29T00:00:00Z'))
        .fromDay,
    ).toBe('2023-03-01');
    expect(
      reportPresetDates('LAST_30_DAYS', new Date('2026-01-01T00:00:00Z'))
        .fromDay,
    ).toBe('2025-12-03');
  });
  it('uses the first valid instant on historical Manila midnight transitions', () => {
    expect(
      reportUtcRange({ fromDay: '1954-04-12', throughDay: '1954-04-12' }),
    ).toEqual({
      from: '1954-04-11T16:00:00.000Z',
      until: '1954-04-12T15:00:00.000Z',
    });
    expect(
      reportDateRangeSchema.safeParse({
        fromDay: '0001-01-01',
        throughDay: '2026-01-01',
      }).success,
    ).toBe(false);
    expect(
      reportDateRangeSchema.safeParse({
        fromDay: '2026-01-01',
        throughDay: '9999-12-31',
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
