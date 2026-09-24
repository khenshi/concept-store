import { useState } from 'react';
import type { StaffSalesAnalytics } from '../model/report.schemas';

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
}: {
  rows: AnalyticsTrendRow[];
  kind: 'activity' | 'net';
  own: boolean;
}) {
  const gross = rows.map((row) => cents(row.grossSales));
  const refunds = rows.map((row) => cents(row.refundedAmount));
  const net = rows.map((row) => BigInt(row.netRecordedSales.replace('.', '')));
  const values =
    kind === 'activity'
      ? [...gross, ...refunds, BigInt(0)]
      : [...net, BigInt(0)];
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
    <section className="bg-surface py-5 sm:py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">
            {kind === 'activity'
              ? `${own ? 'Own gross sales' : 'Gross sales'} and refunds`
              : `${own ? 'Own net recorded sales' : 'Net recorded sales'}`}
          </h2>
          <p className="mt-1 text-xs text-muted">
            Daily, Asia/Manila · zero line shown
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
            <span key={row!.date}>{row!.date.slice(5)}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AnalyticsTrendCharts({
  rows,
  own = false,
  className = 'mt-6 grid gap-4 xl:grid-cols-2',
}: {
  rows: AnalyticsTrendRow[];
  own?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <TrendChart rows={rows} kind="activity" own={own} />
      <TrendChart rows={rows} kind="net" own={own} />
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

function SelectableStaffTrendChart({ rows }: { rows: AnalyticsTrendRow[] }) {
  const [metric, setMetric] = useState<StaffTrendMetric>('netRecordedSales');
  const selectedMetric = staffTrendMetrics.find(
    (candidate) => candidate.value === metric,
  )!;
  const values = rows.map((row) => ({
    date: row.date,
    amount:
      metric === 'netRecordedSales'
        ? BigInt(row.netRecordedSales.replace('.', ''))
        : cents(row[metric]),
  }));
  const extent = [...values.map((row) => row.amount), BigInt(0)];
  const min = extent.reduce((result, value) =>
    value < result ? value : result,
  );
  const max = extent.reduce((result, value) =>
    value > result ? value : result,
  );
  const dates = [
    values[0],
    values[Math.floor((values.length - 1) / 2)],
    values.at(-1),
  ].filter(
    (row, index, list) =>
      row &&
      list.findIndex((candidate) => candidate?.date === row.date) === index,
  );
  const hasValues = values.some((row) => row.amount !== BigInt(0));

  return (
    <section className="data-surface min-w-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-semibold">Daily sales trend</h2>
          <p className="mt-1 text-sm text-muted">
            {selectedMetric.label} by Philippine date for the applied report
            period. Net sales may fall below zero when refunds exceed sales.
          </p>
        </div>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Sales trend metric</legend>
          {staffTrendMetrics.map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 cursor-pointer items-center rounded-md border border-hairline px-3 py-2 text-sm font-medium focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2 has-[:checked]:border-ink has-[:checked]:bg-subtle"
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
      {!hasValues ? (
        <p role="status" className="px-5 pt-5 text-sm text-muted sm:px-6">
          {selectedMetric.emptyMessage}
        </p>
      ) : null}
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
              values.map((row) => row.amount),
              min,
              max,
            )}
            fill="none"
            stroke={selectedMetric.color}
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
          {values.map((row, index) => (
            <circle
              key={row.date}
              cx={
                values.length === 1 ? 300 : (index * 600) / (values.length - 1)
              }
              cy={scale(row.amount, min, max)}
              r="3"
              fill={selectedMetric.color}
            />
          ))}
        </svg>
        <div className="flex justify-between gap-2 text-xs text-muted">
          {dates.map((row) => (
            <span key={row!.date}>{row!.date.slice(5)}</span>
          ))}
        </div>
      </div>
      <ol
        aria-label={`${selectedMetric.label} exact daily values`}
        className="sr-only"
      >
        {values.map((row) => (
          <li
            key={row.date}
          >{`${row.date}: ${money(fromCents(row.amount))}`}</li>
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
      <header className="border-b border-hairline px-5 py-5 sm:px-6">
        <h2 className="font-semibold">Average sales by weekday</h2>
        <p className="mt-1 text-sm text-muted">
          Average sales for each weekday, calculated using all matching days in the selected period, including days with no sales.
        </p>
      </header>
      {!hasGrossSales ? (
        <p role="status" className="px-5 pt-5 text-sm text-muted sm:px-6">
          No gross sales in this period.
        </p>
      ) : null}
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
      <header className="border-b border-hairline px-5 py-5 sm:px-6">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </header>
      {rows.length ? (
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
      ) : (
        <p role="status" className="px-5 py-5 text-sm text-muted sm:px-6">
          {emptyMessage}
        </p>
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
        {total === BigInt(0) ? (
          <p role="status" className="w-full text-sm text-muted">
            {emptyMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function StaffAnalyticsDashboard({
  report,
}: {
  report: StaffSalesAnalytics;
}) {
  const empty = report.transactionCount === '0' && report.refundCount === '0';
  return (
    <>
      {empty ? (
        <p role="status" className="mt-5 text-sm text-muted">
          No completed sales or refunds in this branch for the applied period.
        </p>
      ) : null}
      <dl
        aria-label="Sales analytics summary"
        className="mt-6 grid gap-y-2 border-y border-hairline sm:grid-cols-2 lg:grid-cols-4 lg:gap-y-0"
      >
        {[
          ['Gross recorded sales', money(report.grossSales), 'Before refunds'],
          [
            'Refunded amount',
            money(report.refundedAmount),
            `${report.refundCount} completed refunds`,
          ],
          [
            'Net recorded sales',
            money(report.netRecordedSales),
            'Gross minus refunds',
          ],
          [
            'Completed transactions',
            report.transactionCount,
            `${report.unitsSold} units sold`,
          ],
        ].map(([label, value, detail], index) => (
          <div
            key={label}
            className="relative min-w-0 py-5 sm:px-5 lg:first:pl-0 lg:last:pr-0"
          >
            {index > 0 ? (
              <span
                aria-hidden="true"
                className="absolute inset-y-5 left-0 hidden w-px bg-hairline lg:block"
              />
            ) : null}
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-3 break-all text-2xl font-semibold tracking-tight tabular-nums">
              {value}
            </dd>
            <dd className="mt-2 text-xs text-muted">{detail}</dd>
          </div>
        ))}
      </dl>
      <div
        role="group"
        aria-label="Sales analytics charts"
        className="mt-6 space-y-4"
      >
        <SelectableStaffTrendChart rows={report.dailyTrends} />
        <div
          role="group"
          aria-label="Performance charts"
          className="grid gap-4 md:grid-cols-2"
        >
          <HorizontalSalesBars
            title="Top merchants by gross sales"
            description="Top 5 merchants with the highest gross sales for the selected period."
            rows={report.topMerchants.slice(0, 5).map((row) => ({
              id: row.merchantId,
              label: row.merchantName,
              grossSales: row.grossSales,
            }))}
            emptyMessage="No merchant gross sales in this period."
          />
          <HorizontalSalesBars
            title="Top products by gross sales"
            description="Top 5 products with the highest gross sales for the selected period."
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
          aria-label="Weekday and payment method charts"
          className="grid gap-4 md:grid-cols-3"
        >
          <div className="min-w-0 md:col-span-2">
            <AverageWeekdayChart rows={report.dailyTrends} />
          </div>
          <div className="min-w-0 md:col-span-1">
            <PaymentMethodDonut
              title="Gross sales by payment method"
              description="Gross sales by payment method. GCash and card payments are manually recorded."
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
      </div>
      <details className="data-surface mt-4">
        <summary className="min-h-11 cursor-pointer px-5 py-3 text-sm font-semibold sm:px-6">
          View exact daily data
        </summary>
        <div className="overflow-x-auto border-t border-hairline">
          <table className="data-table w-full min-w-[50rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Exact daily sales analytics in Asia/Manila
            </caption>
            <thead className="bg-subtle text-xs uppercase tracking-[0.08em] text-muted">
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
                  <th
                    key={value}
                    scope="col"
                    className="border-b border-hairline px-4 py-3 font-semibold"
                  >
                    {value}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {report.dailyTrends.map((row) => (
                <tr key={row.date}>
                  <th scope="row" className="px-4 py-3 font-medium">
                    {row.date}
                  </th>
                  {[
                    money(row.grossSales),
                    row.transactionCount,
                    row.unitsSold,
                    money(row.refundedAmount),
                    row.refundCount,
                    row.returnedUnits,
                    money(row.netRecordedSales),
                  ].map((value, index) => (
                    <td key={index} className="px-4 py-3 tabular-nums">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <section className="data-surface mt-8">
        <header className="border-b border-hairline px-5 py-5 sm:px-6">
          <h2 className="font-semibold">Top products by gross sales</h2>
          <p className="mt-1 text-sm text-muted">
            Top {report.topProducts.length} of {report.totalProducts}{' '}
            contributing products. Saved sale identity; not current inventory or
            pricing.
          </p>
        </header>
        {report.topProducts.length ? (
          <div className="overflow-x-auto">
            <table
              aria-label="Top products by gross sales"
              className="data-table w-full min-w-[62rem] border-collapse text-left text-sm"
            >
              <thead className="bg-subtle text-xs uppercase tracking-[0.08em] text-muted">
                <tr>
                  {[
                    'Rank',
                    'Product',
                    'SKU / barcode',
                    'Merchant',
                    'Units sold',
                    'Gross sales',
                    'Returned',
                    'Refunded',
                    'Net recorded',
                  ].map((value) => (
                    <th
                      key={value}
                      scope="col"
                      className="border-b border-hairline px-4 py-3 font-semibold"
                    >
                      {value}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {report.topProducts.map((row, index) => (
                  <tr key={row.productId}>
                    <td className="px-4 py-4 tabular-nums">{index + 1}</td>
                    <th
                      scope="row"
                      className="max-w-64 px-4 py-4 font-semibold"
                    >
                      <span className="block break-words">
                        {row.productName}
                      </span>
                      <span className="mt-1 block break-all text-xs font-normal text-muted">
                        {row.productId}
                      </span>
                    </th>
                    <td className="px-4 py-4">
                      {row.sku ?? '—'} / {row.barcode ?? '—'}
                    </td>
                    <td className="max-w-48 break-words px-4 py-4">
                      {row.merchantName}
                    </td>
                    <td className="px-4 py-4 tabular-nums">{row.unitsSold}</td>
                    <td className="px-4 py-4 tabular-nums">
                      {money(row.grossSales)}
                    </td>
                    <td className="px-4 py-4 tabular-nums">
                      {row.returnedUnits}
                    </td>
                    <td className="px-4 py-4 tabular-nums">
                      {money(row.refundedAmount)}
                    </td>
                    <td className="px-4 py-4 tabular-nums">
                      {money(row.netRecordedSales)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-5 text-sm text-muted">
            No products contributed sales or refunds in this period.
          </p>
        )}
      </section>
    </>
  );
}
