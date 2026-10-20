import {
  calendarDay,
  DAY_MS,
  manilaMidnight,
  REPORT_MAX_UNTIL,
  REPORT_MIN_FROM,
  reportDates,
  reportGranularity,
  reportRange,
} from './report-period';

describe('Report period bounds and buckets', () => {
  it.each([
    '1936-11-01',
    '1941-12-16',
    '1954-04-12',
    '1977-03-28',
    '1990-05-21',
  ])(
    'resolves skipped Manila midnight to the start of %s, never the prior date',
    (date) => {
      const first = manilaMidnight(date);
      expect(
        new Date(calendarDay(first) * DAY_MS).toISOString().slice(0, 10),
      ).toBe(date);
      expect(calendarDay(new Date(first.getTime() - 1))).toBe(
        calendarDay(first) - 1,
      );
    },
  );
  it('uses the historical +09:00 offset within DST periods', () => {
    expect(manilaMidnight('1954-05-01').toISOString()).toBe(
      '1954-04-30T15:00:00.000Z',
    );
  });
  it('supports finite history and generates only bounded yearly buckets', () => {
    const { from, until } = reportRange({
      from: REPORT_MIN_FROM,
      until: REPORT_MAX_UNTIL,
    });
    expect(reportGranularity(from, until)).toBe('YEAR');
    const buckets = reportDates(from, until, 'YEAR');
    expect(buckets).toHaveLength(8100);
    expect(buckets[0]).toBe('1900-01-01');
    expect(buckets.at(-1)).toBe('9999-01-01');
    expect(reportDates(from, until, 'DAY', 2000000, 31)).toHaveLength(31);
  });
  it('preserves the exact <=366-day contract and groups five calendar years monthly', () => {
    const from = new Date('2020-02-29T00:00:00Z');
    expect(
      reportGranularity(from, new Date(from.getTime() + 366 * DAY_MS)),
    ).toBe('DAY');
    expect(
      reportGranularity(from, new Date(from.getTime() + 366 * DAY_MS + 1)),
    ).toBe('MONTH');
    expect(reportGranularity(from, new Date('2025-02-28T00:00:00Z'))).toBe(
      'MONTH',
    );
    expect(reportGranularity(from, new Date('2025-02-28T00:00:00.001Z'))).toBe(
      'YEAR',
    );
  });
  it('labels partially intersected buckets at calendar starts without an extra exclusive date', () => {
    expect(
      reportDates(
        new Date('2024-02-29T15:59:59Z'),
        new Date('2026-03-01T16:00:00Z'),
        'MONTH',
      ),
    ).toHaveLength(26);
    expect(
      reportDates(
        new Date('2024-02-29T15:59:59Z'),
        new Date('2026-02-28T16:00:00Z'),
        'YEAR',
      ),
    ).toEqual(['2024-01-01', '2025-01-01', '2026-01-01']);
    expect(
      reportDates(
        new Date('2024-02-28T16:00:00Z'),
        new Date('2024-02-29T16:00:00Z'),
        'DAY',
      ),
    ).toEqual(['2024-02-29']);
  });
  it.each(['1900-01-01', '2024-02-29', '9999-12-30'])(
    'normalizes Manila midnight for %s',
    (date) => {
      expect(
        new Date(calendarDay(manilaMidnight(date)) * DAY_MS)
          .toISOString()
          .slice(0, 10),
      ).toBe(date);
      expect(manilaMidnight(date).getUTCHours()).toBe(16);
    },
  );
  it.each([
    { from: 'bad', until: REPORT_MAX_UNTIL },
    { from: REPORT_MIN_FROM, until: 'bad' },
    { from: '1899-12-31T15:59:59.999Z', until: REPORT_MAX_UNTIL },
    { from: REPORT_MIN_FROM, until: '9999-12-30T16:00:00.001Z' },
    { from: REPORT_MIN_FROM, until: REPORT_MIN_FROM },
  ])('rejects invalid or unsupported explicit bounds %j', (query) => {
    expect(() => reportRange(query)).toThrow();
  });
});
