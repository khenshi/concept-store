import {
  reportDateRangeSchema,
  reportPresets,
  type ReportDateRange,
  type ReportPreset,
} from './report-dates';

export type ReportRouteTab = 'overview' | 'transactions' | 'daily' | 'rankings';
type ReportSelection = { dates: ReportDateRange; preset: ReportPreset };

export function reportTabPath(tab: ReportRouteTab) {
  return tab === 'daily' ? 'daily-data' : tab;
}

export function reportTabFromPath(pathname: string): ReportRouteTab {
  const segment = pathname.replace(/\/+$/, '').split('/').at(-1);
  if (segment === 'daily-data') return 'daily';
  if (segment === 'transactions' || segment === 'rankings') return segment;
  return 'overview';
}

function page(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 21474836
    ? parsed
    : 1;
}

export function parseReportLocation(
  params: URLSearchParams,
  fallback: ReportSelection,
  merchant: boolean,
) {
  const dates = reportDateRangeSchema.safeParse({
    fromDay: params.get('fromDay'),
    throughDay: params.get('throughDay'),
  });
  const preset = reportPresets.find(
    (item) => item.value === params.get('preset'),
  )?.value;
  const selection: ReportSelection = dates.success
    ? { dates: dates.data, preset: preset ?? 'CUSTOM' }
    : fallback;
  const transactionType = params.get('transactionType');
  const type: 'ALL' | 'SALE' | 'REFUND' =
    transactionType === 'SALE' || transactionType === 'REFUND'
      ? transactionType
      : 'ALL';
  const rankingMerchant = params.get('rankingMerchant');
  return {
    selection,
    transaction: {
      page: page(params.get('transactionPage')),
      type,
      q: (params.get('transactionQ') ?? '').trim().slice(0, 254),
    },
    ranking: {
      page: page(params.get('rankingPage')),
      sortBy:
        params.get('rankingSort') === 'UNITS_SOLD'
          ? ('UNITS_SOLD' as const)
          : ('GROSS_SALES' as const),
      merchantId:
        !merchant &&
        rankingMerchant &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          rankingMerchant,
        )
          ? rankingMerchant
          : null,
    },
    dailyPage: page(params.get('dailyPage')),
  };
}

export function reportLocationParams(
  selection: ReportSelection,
): URLSearchParams {
  return new URLSearchParams({
    preset: selection.preset,
    fromDay: selection.dates.fromDay,
    throughDay: selection.dates.throughDay,
  });
}
