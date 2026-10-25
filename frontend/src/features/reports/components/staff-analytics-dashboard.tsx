import { useState, type ReactNode } from 'react';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { OperationalCollection } from '@/shared/components/ui/operational-page';
import {
  OperationalTable,
  OperationalTableFrame,
} from '@/shared/components/ui/operational-table';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { RequestError } from '@/shared/components/ui/request-error';
import { SelectControl } from '@/shared/components/ui/select-control';
import type {
  ReportMerchantOption,
  ReportRankingControls,
  ReportRankingSort,
  StaffSalesAnalytics,
  StaffSalesRankingPage,
} from '../model/report.schemas';

export type SalesReportTab = 'overview' | 'transactions' | 'daily' | 'rankings';
export type ChartGranularity = 'DAY' | 'MONTH' | 'YEAR';

const granularityLabels = { DAY: 'Daily', MONTH: 'Monthly', YEAR: 'Yearly' };
const trendDateLabel = (date: string, granularity: ChartGranularity) =>
  granularity === 'YEAR'
    ? date.slice(0, 4)
    : granularity === 'MONTH'
      ? date.slice(0, 7)
      : date.slice(5);

function cents(value: string) {
  return BigInt(value.replace('.', ''));
}
function fromCents(value: bigint) {
  const sign = value < BigInt(0) ? '-' : '';
  const absolute = value < BigInt(0) ? -value : value;
  return `${sign}${absolute / BigInt(100)}.${(absolute % BigInt(100))
    .toString()
    .padStart(2, '0')}`;
}
function money(value: string) {
  return `PHP ${value}`;
}

export type ReportSummaryMetric = {
  label: string;
  value: string;
  detail: string;
};

export function ReportSummary({
  primary,
  supporting,
  ariaLabel,
}: {
  primary: ReportSummaryMetric;
  supporting: ReportSummaryMetric[];
  ariaLabel: string;
}) {
  return (
    <section
      aria-labelledby="sales-summary-heading"
      className="data-surface mt-1 px-4 pb-6"
    >
      <dl
        aria-label={ariaLabel}
        className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1.35fr)_repeat(3,minmax(0,1fr))] lg:gap-0"
      >
        <div className="min-w-0 lg:pr-6">
          <dt className="text-sm font-medium text-muted">{primary.label}</dt>
          <dd className="mt-2 break-all text-3xl font-semibold tracking-tight tabular-nums">
            {primary.value}
          </dd>
          <dd className="mt-1 text-xs text-muted">{primary.detail}</dd>
        </div>
        {supporting.map((metric) => (
          <div
            key={metric.label}
            className="min-w-0 border-hairline sm:pl-5 lg:border-l lg:py-1"
          >
            <dt className="text-sm text-muted">{metric.label}</dt>
            <dd className="mt-2 break-all text-xl font-semibold tracking-tight tabular-nums">
              {metric.value}
            </dd>
            <dd className="mt-1 text-xs text-muted">{metric.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function barPercent(value: bigint, max: bigint) {
  if (max === BigInt(0) || value === BigInt(0)) return 0;
  return Number((value * BigInt(1000000)) / max) / 10000;
}
function scale(value: bigint, min: bigint, max: bigint, height = 150) {
  if (max === min) return Math.floor(height / 2);
  return height - Number(((value - min) * BigInt(height)) / (max - min));
}
function points(values: bigint[], min: bigint, max: bigint) {
  return values
    .map((value, index) => {
      const x =
        values.length === 1
          ? 300
          : Math.round((index * 600) / (values.length - 1));
      return `${x},${scale(value, min, max)}`;
    })
    .join(' ');
}
function samplePoints<T>(rows: T[], limit = 7) {
  if (rows.length <= limit) return rows;
  return Array.from(
    { length: limit },
    (_, index) => rows[Math.round((index * (rows.length - 1)) / (limit - 1))],
  );
}
function formatHour(hour: number) {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}
export interface AnalyticsTrendRow {
  date: string;
  grossSales: string;
  refundedAmount: string;
  netRecordedSales: string;
}
function TrendChart({
  rows,
  kind,
  own,
  granularity,
}: {
  rows: AnalyticsTrendRow[];
  kind: 'activity' | 'net';
  own: boolean;
  granularity: ChartGranularity;
}) {
  const gross = rows.map((row) => cents(row.grossSales));
  const refunds = rows.map((row) => cents(row.refundedAmount));
  const net = rows.map((row) => BigInt(row.netRecordedSales.replace('.', '')));
  const values =
    kind === 'activity'
      ? [...gross, ...refunds, BigInt(0)]
      : [...net, BigInt(0)];
  const hasValues =
    kind === 'activity'
      ? gross.some((value) => value !== BigInt(0)) ||
        refunds.some((value) => value !== BigInt(0))
      : net.some((value) => value !== BigInt(0));
  const title =
    kind === 'activity'
      ? `${own ? 'Own gross sales' : 'Gross sales'} and refunds`
      : `${own ? 'Own net recorded sales' : 'Net recorded sales'}`;
  if (!hasValues) {
    return (
      <section className="data-surface">
        <EmptyState
          className="m-4"
          title={title}
          description={
            kind === 'activity'
              ? 'No sales or refunds in this period.'
              : 'No net sales in this period.'
          }
        />
      </section>
    );
  }
  const min = values.reduce((result, value) =>
    value < result ? value : result,
  );
  const max = values.reduce((result, value) =>
    value > result ? value : result,
  );
  const labels = [
    rows[0],
    rows[Math.floor((rows.length - 1) / 2)],
    rows.at(-1),
  ].filter(
    (row, index, rows) =>
      row &&
      rows.findIndex((candidate) => candidate?.date === row.date) === index,
  );
  return (
    <section className="data-surface py-5 sm:py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-muted">
            {granularityLabels[granularity]}, Asia/Manila · zero line shown
          </p>
        </div>
        <div
          className="flex flex-wrap gap-4 text-xs text-muted"
          aria-hidden="true"
        >
          {kind === 'activity' ? (
            <>
              <span>━ {own ? 'Own gross sales' : 'Gross sales'}</span>
              <span>┄ {own ? 'Own refunds' : 'Refunds'}</span>
            </>
          ) : (
            <span>
              ━ {own ? 'Own net recorded sales' : 'Net recorded sales'}
            </span>
          )}
        </div>
      </div>
      <div className="mt-6 overflow-hidden" aria-hidden="true">
        <svg
          aria-hidden="true"
          viewBox="0 0 600 180"
          className="h-48 w-full overflow-visible"
          preserveAspectRatio="none"
        >
          <line
            x1="0"
            y1={scale(BigInt(0), min, max)}
            x2="600"
            y2={scale(BigInt(0), min, max)}
            stroke="var(--color-border-strong)"
            strokeWidth="1"
          />
          {kind === 'activity' ? (
            <>
              <polyline
                points={points(gross, min, max)}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
              <polyline
                points={points(refunds, min, max)}
                fill="none"
                stroke="var(--color-danger)"
                strokeWidth="2"
                strokeDasharray="7 6"
                vectorEffect="non-scaling-stroke"
              />
            </>
          ) : (
            <polyline
              points={points(net, min, max)}
              fill="none"
              stroke="var(--color-success-ink)"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <div className="flex justify-between gap-2 text-xs text-muted">
          {labels.map((row) => (
            <span key={row!.date}>
              {trendDateLabel(row!.date, granularity)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AnalyticsTrendCharts({
  rows,
  own = false,
  granularity = 'DAY',
  className = 'mt-6 grid gap-4 xl:grid-cols-2',
}: {
  rows: AnalyticsTrendRow[];
  own?: boolean;
  granularity?: ChartGranularity;
  className?: string;
}) {
  return (
    <div className={className}>
      <TrendChart
        rows={rows}
        kind="activity"
        own={own}
        granularity={granularity}
      />
      <TrendChart rows={rows} kind="net" own={own} granularity={granularity} />
    </div>
  );
}

type StaffTrendMetric = 'netRecordedSales' | 'grossSales' | 'refundedAmount';

const staffTrendMetrics: {
  value: StaffTrendMetric;
  label: string;
  color: string;
  emptyMessage: string;
}[] = [
  {
    value: 'netRecordedSales',
    label: 'Net Sales',
    color: 'var(--color-success-ink)',
    emptyMessage: 'Net sales are zero on every date in this period.',
  },
  {
    value: 'grossSales',
    label: 'Gross Sales',
    color: 'var(--color-accent)',
    emptyMessage: 'No gross sales in this period.',
  },
  {
    value: 'refundedAmount',
    label: 'Refunds',
    color: 'var(--color-danger)',
    emptyMessage: 'No refunds in this period.',
  },
];

function SelectableStaffTrendChart({
  rows,
  hourlyRows,
  granularity = 'DAY',
}: {
  rows: AnalyticsTrendRow[];
  hourlyRows?: StaffSalesAnalytics['hourlyTrends'];
  granularity?: ChartGranularity;
}) {
  const [metric, setMetric] = useState<StaffTrendMetric>('netRecordedSales');
  const selectedMetric = staffTrendMetrics.find(
    (candidate) => candidate.value === metric,
  )!;
  const isHourly =
    granularity === 'DAY' && rows.length === 1 && hourlyRows?.length === 24;
  const values = isHourly
    ? hourlyRows!.map((row) => ({
        key: String(row.hour),
        axisLabel: formatHour(row.hour),
        accessibleLabel: formatHour(row.hour),
        amount:
          metric === 'netRecordedSales'
            ? BigInt(row.netRecordedSales.replace('.', ''))
            : cents(row[metric]),
      }))
    : rows.map((row) => ({
        key: row.date,
        axisLabel: trendDateLabel(row.date, granularity),
        accessibleLabel: row.date,
        amount:
          metric === 'netRecordedSales'
            ? BigInt(row.netRecordedSales.replace('.', ''))
            : cents(row[metric]),
      }));
  const plottedValues = samplePoints(values);
  const extent = [...values.map((row) => row.amount), BigInt(0)];
  const min = extent.reduce((result, value) =>
    value < result ? value : result,
  );
  const max = extent.reduce((result, value) =>
    value > result ? value : result,
  );
  const hasValues = values.some((row) => row.amount !== BigInt(0));

  return (
    <section className="data-surface min-w-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-semibold">
            {isHourly
              ? 'Hourly sales trend'
              : `${granularityLabels[granularity]} sales trend`}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {`${selectedMetric.label} by Philippine ${isHourly ? 'hour' : granularity === 'MONTH' ? 'month' : granularity === 'YEAR' ? 'year' : 'date'}. Net sales may fall below zero after refunds.`}
          </p>
        </div>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Sales trend metric</legend>
          {staffTrendMetrics.map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 cursor-pointer items-center rounded-full border border-hairline px-4 py-2 text-sm font-medium focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2 has-[:checked]:border-ink has-[:checked]:bg-subtle"
            >
              <input
                className="sr-only"
                type="radio"
                name="staff-sales-trend-metric"
                value={option.value}
                checked={metric === option.value}
                onChange={() => setMetric(option.value)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      </header>
      {hasValues ? (
        <div className="px-5 py-5 sm:px-6">
          <svg
            aria-hidden="true"
            viewBox="0 0 600 180"
            className="h-48 w-full"
            preserveAspectRatio="none"
          >
            <line
              x1="0"
              y1={scale(BigInt(0), min, max)}
              x2="600"
              y2={scale(BigInt(0), min, max)}
              stroke="var(--color-border-strong)"
              strokeWidth="1"
            />
            <polyline
              points={points(
                plottedValues.map((row) => row.amount),
                min,
                max,
              )}
              fill="none"
              stroke={selectedMetric.color}
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
            {plottedValues.map((row, index) => (
              <circle
                key={row.key}
                cx={
                  plottedValues.length === 1
                    ? 300
                    : (index * 600) / (plottedValues.length - 1)
                }
                cy={scale(row.amount, min, max)}
                r="3"
                fill={selectedMetric.color}
              />
            ))}
          </svg>
          <div className="flex justify-between gap-2 text-xs text-muted">
            {plottedValues.map((row) => (
              <span key={row.key}>{row.axisLabel}</span>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          className="m-5"
          title={`No ${selectedMetric.label.toLocaleLowerCase()} data.`}
          description={
            granularity === 'DAY'
              ? selectedMetric.emptyMessage
              : selectedMetric.emptyMessage.replace(
                  'every date',
                  granularity === 'MONTH' ? 'every month' : 'every year',
                )
          }
        />
      )}
      <ol
        aria-label={`${selectedMetric.label} exact ${isHourly ? 'hourly' : granularityLabels[granularity].toLowerCase()} values`}
        className="sr-only"
      >
        {values.map((row) => (
          <li
            key={row.key}
          >{`${row.accessibleLabel}: ${money(fromCents(row.amount))}`}</li>
        ))}
      </ol>
    </section>
  );
}

const weekdays = [
  { label: 'Sunday', index: 0 },
  { label: 'Monday', index: 1 },
  { label: 'Tuesday', index: 2 },
  { label: 'Wednesday', index: 3 },
  { label: 'Thursday', index: 4 },
  { label: 'Friday', index: 5 },
  { label: 'Saturday', index: 6 },
];

function AverageWeekdayChart({ rows }: { rows: AnalyticsTrendRow[] }) {
  const totals = Array.from({ length: 7 }, () => ({
    grossCents: BigInt(0),
    dateCount: 0,
  }));
  for (const row of rows) {
    const weekday = new Date(`${row.date}T00:00:00Z`).getUTCDay();
    totals[weekday].grossCents += cents(row.grossSales);
    totals[weekday].dateCount += 1;
  }
  const averages = weekdays.map(({ label, index }) => {
    const { grossCents, dateCount } = totals[index];
    const roundedCents =
      dateCount === 0
        ? null
        : (grossCents + BigInt(Math.floor(dateCount / 2))) / BigInt(dateCount);
    return { label, dateCount, averageCents: roundedCents };
  });
  const max = averages.reduce(
    (value, row) =>
      row.averageCents !== null && row.averageCents > value
        ? row.averageCents
        : value,
    BigInt(0),
  );
  const hasGrossSales = totals.some((row) => row.grossCents > BigInt(0));

  return (
    <section className="data-surface min-w-0">
      {hasGrossSales ? (
        <>
          <header className="px-5 sm:px-6 border-b border-hairline py-5">
            <h2 className="font-semibold">Average sales by weekday</h2>
            <p className="mt-1 text-sm text-muted">
              Gross sales by weekday across the period, including zero-sales
              dates.
            </p>
          </header>
          <ol
            aria-label="Average gross sales by weekday values"
            className="m-0 list-none space-y-4 p-5 sm:px-6"
          >
            {averages.map((row) => (
              <li
                key={row.label}
                aria-label={`${row.label}: ${row.averageCents === null ? 'No dates in this period' : `${money(fromCents(row.averageCents))} average across ${row.dateCount} ${row.dateCount === 1 ? 'date' : 'dates'}`}`}
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{row.label}</span>
                  <span className="shrink-0 text-right tabular-nums">
                    {row.averageCents === null
                      ? 'No dates'
                      : money(fromCents(row.averageCents))}
                    {row.averageCents !== null ? (
                      <span className="ml-2 text-xs text-muted">
                        {row.dateCount} {row.dateCount === 1 ? 'date' : 'dates'}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="mt-2 h-2 overflow-hidden rounded-full bg-subtle"
                >
                  <span
                    className="block h-full rounded-full bg-ink"
                    style={{
                      width: `${row.averageCents === null ? 0 : barPercent(row.averageCents, max)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <EmptyState
          className="m-5"
          title="Average sales by weekday"
          description="No weekday sales to compare in this period."
        />
      )}
    </section>
  );
}

function HorizontalSalesBars({
  title,
  description,
  rows,
  emptyMessage,
  className = '',
}: {
  title: string;
  description: string;
  rows: {
    id: string;
    label: string;
    detail?: string;
    grossSales: string;
  }[];
  emptyMessage: string;
  className?: string;
}) {
  const max = rows.reduce((value, row) => {
    const amount = cents(row.grossSales);
    return amount > value ? amount : value;
  }, BigInt(0));
  return (
    <section className={`data-surface min-w-0 ${className}`.trim()}>
      {rows.length ? (
        <>
          <header className="border-b border-hairline px-5 py-5 sm:px-6">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </header>
          <ol aria-label={`${title} values`} className="m-0 list-none p-0">
            {rows.map((row, index) => (
              <li
                key={row.id}
                className="data-row px-5 py-4 sm:px-6"
                aria-label={`${index + 1}. ${row.label}${row.detail ? `, ${row.detail}` : ''}: ${money(row.grossSales)}`}
              >
                <div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words font-medium">
                    <span className="block">{row.label}</span>
                    {row.detail ? (
                      <span className="mt-1 block break-all text-xs font-normal text-muted">
                        {row.detail}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {money(row.grossSales)}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="mt-3 h-2 overflow-hidden rounded-full bg-subtle"
                >
                  <span
                    className="block h-full rounded-full bg-ink"
                    style={{
                      width: `${barPercent(cents(row.grossSales), max)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <EmptyState className="m-5" title={title} description={emptyMessage} />
      )}
    </section>
  );
}

type PaymentMethod = StaffSalesAnalytics['payments'][number]['paymentMethod'];
type PaymentMethodDonutRow = {
  paymentMethod: PaymentMethod;
  amount: string;
  weight: bigint;
  detail?: string;
};

function PaymentMethodDonut({
  title,
  description,
  rows,
  emptyMessage,
}: {
  title: string;
  description: string;
  rows: PaymentMethodDonutRow[];
  emptyMessage: string;
}) {
  const colors = [
    'var(--color-accent)',
    'var(--color-success-ink)',
    'var(--color-danger)',
  ];
  const labels: Record<PaymentMethod, string> = {
    CASH: 'Cash',
    GCASH: 'GCash',
    CARD: 'Card',
  };
  const total = rows.reduce((sum, row) => sum + row.weight, BigInt(0));
  const shares = rows.map((row) =>
    total === BigInt(0) ? 0 : Number((row.weight * BigInt(1000000)) / total),
  );
  const lastPositive = shares.map((share) => share > 0).lastIndexOf(true);
  const normalizedShares = shares.map((share, index) =>
    index === lastPositive
      ? 1000000 - shares.slice(0, index).reduce((sum, value) => sum + value, 0)
      : share,
  );
  const slices = rows.map((row, index) => ({
    ...row,
    color: colors[['CASH', 'GCASH', 'CARD'].indexOf(row.paymentMethod)],
    share: normalizedShares[index],
    start: normalizedShares
      .slice(0, index)
      .reduce((sum, value) => sum + value, 0),
  }));
  return (
    <section className="data-surface min-w-0">
      {total === BigInt(0) ? (
        <EmptyState className="m-5" title={title} description={emptyMessage} />
      ) : (
        <>
          <header className="border-b border-hairline px-5 py-5 sm:px-6">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </header>
          <div className="grid justify-items-center gap-4 p-5 sm:px-6">
            <svg
              aria-hidden="true"
              viewBox="0 0 42 42"
              className="h-32 w-32 max-w-full -rotate-90"
            >
              <circle
                cx="21"
                cy="21"
                r="15.9155"
                fill="none"
                stroke="var(--color-hairline)"
                strokeWidth="8"
              />
              {slices.map((segment) => (
                <circle
                  key={segment.paymentMethod}
                  cx="21"
                  cy="21"
                  r="15.9155"
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="8"
                  strokeDasharray={`${(segment.share / 1000000) * 100} ${100 - (segment.share / 1000000) * 100}`}
                  strokeDashoffset={-(segment.start / 1000000) * 100}
                />
              ))}
            </svg>
            <dl aria-label={`${title} values`} className="m-0 w-full space-y-3">
              {slices.map((row) => (
                <div
                  key={row.paymentMethod}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <dt className="flex min-w-0 items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: row.color }}
                    />
                    <span>{labels[row.paymentMethod]}</span>
                  </dt>
                  <dd className="shrink-0 text-right tabular-nums">
                    <span className="block">{row.amount}</span>
                    {row.detail ? (
                      <span className="text-xs text-muted">{row.detail}</span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      )}
    </section>
  );
}

export function StaffDailyData({
  rows,
  pagination,
}: {
  rows: StaffSalesAnalytics['dailyTrends'];
  pagination?: ReactNode;
}) {
  const [pageState, setPageState] = useState<{
    rows: StaffSalesAnalytics['dailyTrends'];
    page: number;
  }>({ rows, page: 1 });
  const page = pageState.rows === rows ? pageState.page : 1;
  const pageRows =
    pagination !== undefined ? rows : rows.slice((page - 1) * 15, page * 15);
  const hasNext = page * 15 < rows.length;
  const totalPages = Math.max(1, Math.ceil(rows.length / 15));
  return (
    <OperationalCollection
      surface="data"
      role="tabpanel"
      id="sales-daily-panel"
      aria-labelledby="sales-report-tab-daily"
      tabIndex={0}
      title="Daily sales data"
      description="Exact daily sales analytics in Asia/Manila."
    >
      <OperationalTableFrame
        empty={
          !pageRows.length ? (
            <EmptyState
              className="mt-6"
              title="No daily sales data for this period."
              description="Try a different report date range."
            />
          ) : undefined
        }
        footer={
          pagination !== undefined ? (
            pagination
          ) : (
            <PaginationControls
              ariaLabel="Daily sales pagination"
              currentPage={page}
              totalPages={totalPages}
              hasNext={hasNext}
              summary={`${rows.length} days`}
              onPrevious={() =>
                setPageState({ rows, page: Math.max(1, page - 1) })
              }
              onNext={() => setPageState({ rows, page: page + 1 })}
            />
          )
        }
      >
        {pageRows.length ? (
          <OperationalTable className="min-w-[50rem]">
            <caption className="sr-only">
              Daily sales data in Asia/Manila
            </caption>
            <thead className="text-xs uppercase tracking-[0.08em] text-muted [&_th]:font-normal">
              <tr>
                {[
                  'Date',
                  'Gross sales',
                  'Transactions',
                  'Units sold',
                  'Refunded',
                  'Refunds',
                  'Returned units',
                  'Net recorded sales',
                ].map((value) => (
                  <th key={value} scope="col">
                    {value}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm font-normal text-ink">
              {pageRows.map((row) => (
                <tr key={row.date}>
                  <th scope="row" className="px-4 py-3 font-semibold">
                    {row.date}
                  </th>
                  {[
                    row.grossSales,
                    row.transactionCount,
                    row.unitsSold,
                    row.refundedAmount,
                    row.refundCount,
                    row.returnedUnits,
                  ].map((value, index) => (
                    <td key={index} className="px-4 py-3 tabular-nums">
                      {value}
                    </td>
                  ))}
                  <td
                    className={`px-4 py-3 tabular-nums ${Number(row.netRecordedSales) > 0 ? 'text-success-ink' : Number(row.netRecordedSales) < 0 ? 'text-danger' : 'text-ink'}`}
                  >
                    {Number(row.netRecordedSales) > 0 ? '+' : ''}
                    {row.netRecordedSales}
                  </td>
                </tr>
              ))}
            </tbody>
          </OperationalTable>
        ) : null}
      </OperationalTableFrame>
    </OperationalCollection>
  );
}

export function RankingControls({
  controls,
  merchantOptions = [],
  merchantOptionsLoading = false,
  merchantOptionsError = null,
  showMerchantFilter,
  onMerchantOptionsRetry = () => undefined,
  onChange,
}: {
  controls: ReportRankingControls;
  merchantOptions?: ReportMerchantOption[];
  merchantOptionsLoading?: boolean;
  merchantOptionsError?: string | null;
  showMerchantFilter: boolean;
  onMerchantOptionsRetry?: () => void;
  onChange: (controls: ReportRankingControls) => void;
}) {
  const sortOptions: { value: ReportRankingSort; label: string }[] = [
    { value: 'GROSS_SALES', label: 'Gross sales' },
    { value: 'UNITS_SOLD', label: 'Units sold' },
  ];
  return (
    <div
      className="flex flex-wrap items-end gap-3"
      role="group"
      aria-label="Ranking filters"
      aria-busy={
        showMerchantFilter && merchantOptionsLoading ? true : undefined
      }
    >
      <label
        className="min-w-0 text-xs font-medium text-muted"
        htmlFor="sales-report-ranking-sort"
      >
        <span className="block">Rank by</span>
        <SelectControl
          id="sales-report-ranking-sort"
          aria-label="Rank by"
          value={controls.sortBy}
          className="mt-1 bg-subtle px-4 text-sm font-medium"
          onValueChange={(value) =>
            onChange({
              ...controls,
              sortBy: value as ReportRankingSort,
            })
          }
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectControl>
      </label>
      <span className="sr-only">
        Sorted by{' '}
        {sortOptions.find((option) => option.value === controls.sortBy)?.label}
      </span>
      {showMerchantFilter ? (
        <div className="w-48 text-xs font-medium text-muted">
          <label className="block" htmlFor="sales-report-ranking-merchant">
            Merchant
          </label>
          <SelectControl
            id="sales-report-ranking-merchant"
            aria-label="Merchant"
            value={controls.merchantId ?? ''}
            disabled={merchantOptionsLoading || merchantOptionsError !== null}
            aria-describedby="sales-report-ranking-merchant-status"
            className="mt-1 bg-subtle px-4 text-sm font-medium"
            onValueChange={(value) =>
              onChange({
                ...controls,
                merchantId: value || null,
              })
            }
          >
            <option value="">All merchants</option>
            {merchantOptions.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </SelectControl>
          {merchantOptionsLoading ? (
            <span
              id="sales-report-ranking-merchant-status"
              role="status"
              className="mt-1 block text-xs font-normal text-muted"
            >
              Loading merchants…
            </span>
          ) : merchantOptionsError ? (
            <span
              id="sales-report-ranking-merchant-status"
              className="mt-1 flex items-start gap-2 text-xs font-normal text-danger"
            >
              <span role="status">{merchantOptionsError}</span>
              <button
                type="button"
                className="shrink-0 underline"
                onClick={onMerchantOptionsRetry}
              >
                Try again
              </button>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StaffRankings({
  page,
  loading,
  error,
  errorPage,
  onPageChange,
  controls,
  merchantOptions,
  merchantOptionsLoading,
  merchantOptionsError,
  onMerchantOptionsRetry,
  onControlsChange,
}: {
  page: StaffSalesRankingPage | null;
  loading: boolean;
  error: string | null;
  errorPage: number | null;
  onPageChange(page: number): void;
  controls: ReportRankingControls;
  merchantOptions: ReportMerchantOption[];
  merchantOptionsLoading: boolean;
  merchantOptionsError: string | null;
  onMerchantOptionsRetry: () => void;
  onControlsChange: (controls: ReportRankingControls) => void;
}) {
  const title =
    controls.sortBy === 'UNITS_SOLD'
      ? 'Top products by units sold'
      : 'Top products by gross sales';
  const sortLabel =
    controls.sortBy === 'UNITS_SOLD' ? 'Units sold' : 'Gross sales';
  const merchantLabel = controls.merchantId
    ? (merchantOptions.find((merchant) => merchant.id === controls.merchantId)
        ?.name ?? 'Selected merchant')
    : 'All merchants';
  return (
    <OperationalCollection
      surface="data"
      role="tabpanel"
      id="sales-rankings-panel"
      aria-labelledby="sales-report-tab-rankings"
      tabIndex={0}
      title={title}
      description={`Product rankings by ${sortLabel} for ${merchantLabel}.`}
      controlsPlacement="inline"
      controls={
        <RankingControls
          controls={controls}
          merchantOptions={merchantOptions}
          merchantOptionsLoading={merchantOptionsLoading}
          merchantOptionsError={merchantOptionsError}
          showMerchantFilter
          onMerchantOptionsRetry={onMerchantOptionsRetry}
          onChange={onControlsChange}
        />
      }
    >
      <OperationalTableFrame
        empty={
          page && !loading && !error && !page.items.length ? (
            <EmptyState
              className="mt-6"
              title="No products contributed sales or refunds in this period."
            />
          ) : undefined
        }
        footer={
          page ? (
            <PaginationControls
              ariaLabel="Product rankings pagination"
              currentPage={page.page}
              totalPages={
                page.totalPages ??
                Math.max(1, Math.ceil(Number(page.totalProducts) / 15))
              }
              hasNext={page.hasNext}
              pending={loading}
              summary={`${page.totalProducts} total products`}
              onPrevious={() => onPageChange(page.page - 1)}
              onNext={() => onPageChange(page.page + 1)}
            />
          ) : undefined
        }
      >
        {error && errorPage !== null ? (
          <RequestError
            className="p-5 sm:p-6"
            message={error}
            onRetry={() => onPageChange(errorPage)}
          />
        ) : loading && !page ? (
          <p role="status" className="px-5 py-6 text-sm text-muted sm:px-6">
            Loading product rankings…
          </p>
        ) : page?.items.length ? (
          <OperationalTable
            className="min-w-[46rem] xl:min-w-[62rem]"
            tableProps={{ 'aria-label': title }}
          >
            <thead className="border-b border-hairline bg-surface text-xs uppercase tracking-[0.08em] text-muted [&_th]:font-normal">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-30 w-12 bg-surface px-3"
                >
                  Rank
                </th>
                <th
                  scope="col"
                  className="sticky left-12 z-30 min-w-56 bg-surface px-4"
                >
                  Product
                </th>
                <th scope="col">Merchant</th>
                <th
                  scope="col"
                  aria-sort={
                    controls.sortBy === 'UNITS_SOLD' ? 'descending' : undefined
                  }
                >
                  Units sold
                </th>
                <th
                  scope="col"
                  aria-sort={
                    controls.sortBy === 'GROSS_SALES' ? 'descending' : undefined
                  }
                >
                  Gross sales
                </th>
                <th scope="col">Net recorded</th>
                <th scope="col" className="hidden xl:table-cell">
                  SKU / barcode
                </th>
                <th scope="col" className="hidden xl:table-cell">
                  Returned
                </th>
                <th scope="col" className="hidden xl:table-cell">
                  Refunded
                </th>
              </tr>
            </thead>
            <tbody className="text-sm font-normal text-ink [&_th]:font-normal">
              {page.items.map((row, index) => (
                <tr key={row.productId} className="group">
                  <td className="sticky left-0 z-10 w-12 bg-surface px-3 py-4 text-center align-middle font-semibold tabular-nums transition-colors duration-150 group-hover:bg-subtle">
                    {(page.page - 1) * page.limit + index + 1}
                  </td>
                  <th
                    scope="row"
                    className="sticky left-12 z-10 min-w-56 max-w-64 bg-surface px-4 py-4 font-normal transition-colors duration-150 group-hover:bg-subtle"
                  >
                    <span className="block break-words">{row.productName}</span>
                    <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-sm font-normal leading-5 text-ink xl:hidden">
                      <span>SKU {row.sku ?? '—'}</span>
                      <span>Barcode {row.barcode ?? '—'}</span>
                      <span>Returned {row.returnedUnits}</span>
                      <span>Refunded {row.refundedAmount}</span>
                    </span>
                  </th>
                  <td className="max-w-48 break-words px-4 py-4">
                    {row.merchantName}
                  </td>
                  <td className="px-4 py-4 tabular-nums">{row.unitsSold}</td>
                  <td className="px-4 py-4 tabular-nums">{row.grossSales}</td>
                  <td className="px-4 py-4 tabular-nums">
                    {row.netRecordedSales}
                  </td>
                  <td className="hidden px-4 py-4 xl:table-cell">
                    {row.sku ?? '—'} / {row.barcode ?? '—'}
                  </td>
                  <td className="hidden px-4 py-4 tabular-nums xl:table-cell">
                    {row.returnedUnits}
                  </td>
                  <td className="hidden px-4 py-4 tabular-nums xl:table-cell">
                    {row.refundedAmount}
                  </td>
                </tr>
              ))}
            </tbody>
          </OperationalTable>
        ) : null}
      </OperationalTableFrame>
    </OperationalCollection>
  );
}

export function StaffAnalyticsDashboard({
  report,
  granularity = report.granularity ?? 'DAY',
  activeTab = 'overview',
  ranking,
  rankingControls = { sortBy: 'GROSS_SALES', merchantId: null },
  merchantOptions = [],
  merchantOptionsLoading = false,
  merchantOptionsError = null,
  onMerchantOptionsRetry = () => undefined,
  onRankingControlsChange = () => undefined,
  rankingLoading = false,
  rankingError = null,
  rankingErrorPage = null,
  onRankingPageChange = () => undefined,
}: {
  report: StaffSalesAnalytics;
  granularity?: ChartGranularity;
  activeTab?: SalesReportTab;
  ranking?: StaffSalesRankingPage;
  rankingControls?: ReportRankingControls;
  merchantOptions?: ReportMerchantOption[];
  merchantOptionsLoading?: boolean;
  merchantOptionsError?: string | null;
  onMerchantOptionsRetry?: () => void;
  onRankingControlsChange?: (controls: ReportRankingControls) => void;
  rankingLoading?: boolean;
  rankingError?: string | null;
  rankingErrorPage?: number | null;
  onRankingPageChange?: (page: number) => void;
}) {
  const initialRanking: StaffSalesRankingPage = {
    scope: 'STAFF',
    branch: report.branch,
    from: report.from,
    until: report.until,
    sortBy: 'GROSS_SALES',
    merchantId: null,
    page: 1,
    limit: 15,
    totalProducts: report.totalProducts,
    hasNext: BigInt(15) < BigInt(report.totalProducts),
    items: report.topProducts,
  };
  const isDefaultRanking =
    rankingControls.sortBy === 'GROSS_SALES' &&
    rankingControls.merchantId === null;
  const displayedRanking =
    ranking ?? (isDefaultRanking && !rankingLoading ? initialRanking : null);
  if (activeTab === 'daily')
    return <StaffDailyData rows={report.dailyTrends} />;
  if (activeTab === 'rankings')
    return (
      <StaffRankings
        page={displayedRanking}
        loading={rankingLoading}
        error={rankingError}
        errorPage={rankingErrorPage}
        onPageChange={onRankingPageChange}
        controls={rankingControls}
        merchantOptions={merchantOptions}
        merchantOptionsLoading={merchantOptionsLoading}
        merchantOptionsError={merchantOptionsError}
        onMerchantOptionsRetry={onMerchantOptionsRetry}
        onControlsChange={onRankingControlsChange}
      />
    );
  return (
    <div
      role="tabpanel"
      id="sales-overview-panel"
      aria-labelledby="sales-report-tab-overview"
      tabIndex={0}
    >
      <ReportSummary
        ariaLabel="Sales analytics summary"
        primary={{
          label: 'Net recorded sales',
          value: money(report.netRecordedSales),
          detail: 'Gross minus refunds',
        }}
        supporting={[
          {
            label: 'Gross recorded sales',
            value: money(report.grossSales),
            detail: 'Before refunds',
          },
          {
            label: 'Refunded amount',
            value: money(report.refundedAmount),
            detail: `${report.refundCount} completed refunds`,
          },
          {
            label: 'Completed transactions',
            value: report.transactionCount,
            detail: `${report.unitsSold} units sold`,
          },
        ]}
      />
      <div
        role="group"
        aria-label="Sales analytics charts"
        className="mt-8 space-y-10"
      >
        <SelectableStaffTrendChart
          rows={report.dailyTrends}
          hourlyRows={report.hourlyTrends}
          granularity={granularity}
        />
        <section
          aria-labelledby="sales-explore-heading"
          className="border-t border-hairline pt-8 px-5 "
        >
          <div className="max-w-2xl">
            <h2 id="sales-explore-heading" className="text-base font-semibold">
              Explore the period
            </h2>
            <p className="mt-1 text-sm text-muted">
              {granularity === 'DAY'
                ? 'Gross sales by merchant, product, weekday, and payment method.'
                : 'Gross sales by merchant, product, and payment method.'}
            </p>
          </div>
          <div
            role="group"
            aria-label="Performance charts"
            className="mt-5 grid gap-6 md:grid-cols-2"
          >
            <HorizontalSalesBars
              title="Top merchants by gross sales"
              description="Top 5 merchants by gross sales."
              rows={report.topMerchants.slice(0, 5).map((row) => ({
                id: row.merchantId,
                label: row.merchantName,
                grossSales: row.grossSales,
              }))}
              emptyMessage="No merchant gross sales in this period."
            />
            <HorizontalSalesBars
              title="Top products by gross sales"
              description="Top 5 products by gross sales."
              rows={report.topProducts
                .slice(0, 5)
                .filter((row) => row.grossSales !== '0.00')
                .map((row) => ({
                  id: row.productId,
                  label: row.productName,
                  grossSales: row.grossSales,
                }))}
              emptyMessage="No product gross sales in this period."
            />
          </div>
          <div
            role="group"
            aria-label={
              granularity === 'DAY'
                ? 'Weekday and payment method charts'
                : 'Payment method chart'
            }
            className={`mt-8 grid gap-6 border-t border-hairline pt-8 ${granularity === 'DAY' ? 'md:grid-cols-3' : ''}`}
          >
            {granularity === 'DAY' && (
              <div className="min-w-0 md:col-span-2">
                <AverageWeekdayChart rows={report.dailyTrends} />
              </div>
            )}
            <div className="min-w-0 md:col-span-1">
              <PaymentMethodDonut
                title="Gross sales by payment method"
                description="Gross sales by method. GCash and card are manual."
                rows={report.payments.map((row) => ({
                  paymentMethod: row.paymentMethod,
                  amount: money(row.grossSales),
                  weight: cents(row.grossSales),
                  detail: `${row.transactionCount} transactions`,
                }))}
                emptyMessage="No gross sales by payment method in this period."
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
