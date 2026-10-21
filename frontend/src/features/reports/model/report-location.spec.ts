import { reportPresets, type ReportPreset } from './report-dates';
import {
  parseReportLocation,
  reportLocationParams,
  reportTabFromPath,
  reportTabPath,
} from './report-location';

const fallback = {
  dates: { fromDay: '2026-10-21', throughDay: '2026-10-21' },
  preset: 'TODAY' as ReportPreset,
};
const merchantId = '12345678-1234-4234-8234-123456789abc';
const parse = (query: string, merchant = false) =>
  parseReportLocation(new URLSearchParams(query), fallback, merchant);

describe('report route tabs', () => {
  it.each([
    ['overview', 'overview'],
    ['transactions', 'transactions'],
    ['daily', 'daily-data'],
    ['rankings', 'rankings'],
  ] as const)('maps %s to %s and back', (tab, path) => {
    expect(reportTabPath(tab)).toBe(path);
    expect(
      reportTabFromPath(
        `/app/organizations/org/branches/branch/reports/${path}`,
      ),
    ).toBe(tab);
    expect(reportTabFromPath(`${path}/`)).toBe(tab);
  });
  it.each(['', '/reports', '/reports/unknown', '/reports/daily'])(
    'defaults %s to overview',
    (path) => {
      expect(reportTabFromPath(path)).toBe('overview');
    },
  );
});

describe('report location periods', () => {
  it.each([
    '',
    'preset=THIS_YEAR',
    'fromDay=2024-01-01',
    'throughDay=2024-12-31',
    'preset=CUSTOM&fromDay=2024-02-30&throughDay=2024-03-01',
    'preset=ALL_TIME&fromDay=2026-10-22&throughDay=2026-10-21',
    'fromDay=1899-01-01&throughDay=2026-10-21',
    'fromDay=2024-01-01&throughDay=9999-12-31',
  ])('falls back as a complete selection for %s', (query) => {
    expect(parse(query).selection).toEqual(fallback);
  });
  it.each(reportPresets.map(({ value }) => value))(
    'preserves concrete bounds for %s',
    (preset) => {
      const selection = {
        dates: { fromDay: '2024-02-29', throughDay: '2025-03-01' },
        preset,
      };
      expect(
        parseReportLocation(reportLocationParams(selection), fallback, false)
          .selection,
      ).toEqual(selection);
    },
  );
  it.each(['', '&preset=invalid'])(
    'uses CUSTOM with valid dates and unknown or missing preset',
    (suffix) => {
      expect(
        parse(`fromDay=2024-02-29&throughDay=2024-02-29${suffix}`).selection,
      ).toEqual({
        dates: { fromDay: '2024-02-29', throughDay: '2024-02-29' },
        preset: 'CUSTOM',
      });
    },
  );
  it('serializes only period keys and permits composing tab parameters', () => {
    const params = reportLocationParams({ ...fallback, preset: 'ALL_TIME' });
    expect([...params.entries()]).toEqual([
      ['preset', 'ALL_TIME'],
      ['fromDay', '2026-10-21'],
      ['throughDay', '2026-10-21'],
    ]);
    params.set('transactionPage', '3');
    expect(parseReportLocation(params, fallback, false).transaction.page).toBe(
      3,
    );
    expect(fallback.preset).toBe('TODAY');
  });
});

describe('report location filters', () => {
  it('defaults all independent filters', () => {
    expect(parse('')).toEqual({
      selection: fallback,
      transaction: { page: 1, type: 'ALL', q: '' },
      ranking: { page: 1, sortBy: 'GROSS_SALES', merchantId: null },
      dailyPage: 1,
    });
  });
  it.each([
    '0',
    '-1',
    '1.5',
    '1e2',
    'Infinity',
    '21474837',
    'abc',
    '999999999999999999999',
  ])('defaults invalid page %s', (value) => {
    const result = parse(
      `transactionPage=${value}&rankingPage=${value}&dailyPage=${value}`,
    );
    expect([
      result.transaction.page,
      result.ranking.page,
      result.dailyPage,
    ]).toEqual([1, 1, 1]);
  });
  it('preserves independent pages through the inclusive maximum', () => {
    const result = parse('transactionPage=21474836&rankingPage=2&dailyPage=3');
    expect([
      result.transaction.page,
      result.ranking.page,
      result.dailyPage,
    ]).toEqual([21474836, 2, 3]);
  });
  it.each(['SALE', 'REFUND', 'ALL'] as const)(
    'accepts transaction type %s',
    (type) => {
      expect(parse(`transactionType=${type}`).transaction.type).toBe(type);
    },
  );
  it('normalizes invalid enums and trims and bounds search', () => {
    const params = new URLSearchParams({
      transactionType: 'sale',
      rankingSort: 'invalid',
      transactionQ: `  ${'a'.repeat(260)}  `,
    });
    const result = parseReportLocation(params, fallback, false);
    expect(result.transaction).toEqual({
      page: 1,
      type: 'ALL',
      q: 'a'.repeat(254),
    });
    expect(result.ranking.sortBy).toBe('GROSS_SALES');
    expect(parse('transactionQ=++receipt++').transaction.q).toBe('receipt');
  });
  it('accepts staff merchant and ranking filters but clears merchant overrides for merchants', () => {
    const query = `rankingMerchant=${merchantId}&rankingSort=UNITS_SOLD`;
    expect(parse(query).ranking).toEqual({
      page: 1,
      sortBy: 'UNITS_SOLD',
      merchantId,
    });
    expect(parse(query, true).ranking.merchantId).toBeNull();
  });
  it.each([
    'invalid',
    '12345678-1234-1234-8234-123456789abc',
    '12345678-1234-4234-7234-123456789abc',
    '',
  ])('ignores invalid merchant UUID %s', (value) => {
    expect(parse(`rankingMerchant=${value}`).ranking.merchantId).toBeNull();
  });
  it('does not mutate input parameters or read unrelated query keys', () => {
    const params = new URLSearchParams(
      'page=8&type=SALE&q=ignored&merchantId=ignored',
    );
    const before = params.toString();
    expect(parseReportLocation(params, fallback, false)).toEqual(parse(''));
    expect(params.toString()).toBe(before);
  });
});
