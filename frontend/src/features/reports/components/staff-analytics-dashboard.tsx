import type { StaffSalesAnalytics } from '../model/report.schemas';

function cents(value: string) {
  return BigInt(value.replace('.', ''));
}
function money(value: string) {
  return `PHP ${value}`;
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
    <section className="border-y border-hairline bg-surface py-5 sm:py-6">
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
}: {
  rows: AnalyticsTrendRow[];
  own?: boolean;
}) {
  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-2">
      <TrendChart rows={rows} kind="activity" own={own} />
      <TrendChart rows={rows} kind="net" own={own} />
    </div>
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
        className="mt-6 grid gap-y-2 border-y border-hairline sm:grid-cols-2 xl:grid-cols-4"
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
        ].map(([label, value, detail]) => (
          <div
            key={label}
            className="min-w-0 py-5 sm:px-5 xl:border-l xl:border-hairline xl:first:border-l-0 xl:first:pl-0 xl:last:pr-0"
          >
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-3 break-all text-2xl font-semibold tracking-tight tabular-nums">
              {value}
            </dd>
            <dd className="mt-2 text-xs text-muted">{detail}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-muted">
        Returned units: {report.returnedUnits}. Net is not profit, payout or
        available cash. Refunds use their own completion dates.
      </p>
      <AnalyticsTrendCharts rows={report.dailyTrends} />
      <details className="mt-4 border-y border-hairline bg-surface">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
          View exact daily data
        </summary>
        <div className="overflow-x-auto border-t border-hairline">
          <table className="w-full min-w-[50rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Exact daily sales analytics in Asia/Manila
            </caption>
            <thead className="bg-subtle text-xs text-muted">
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
                    className="px-4 py-3 font-semibold"
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
      <section className="mt-6 border-y border-hairline bg-surface">
        <header className="border-b border-hairline py-5">
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
              className="w-full min-w-[62rem] border-collapse text-left text-sm"
            >
              <thead className="bg-subtle text-xs text-muted">
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
                      className="px-4 py-3 font-semibold"
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
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <MethodPanel
          title="Gross sale payments"
          description="Recorded gross sales by manual method; not tender, available cash or provider reconciliation."
          rows={report.payments.map((row) => ({
            key: row.paymentMethod,
            amount: row.grossSales,
            count: row.transactionCount,
            countLabel: 'transactions',
          }))}
        />
        <MethodPanel
          title="Actual refund methods"
          description="Separate actual refund methods; never netted against sale methods."
          rows={report.refundMethods.map((row) => ({
            key: row.paymentMethod,
            amount: row.refundedAmount,
            count: row.refundCount,
            countLabel: 'refunds',
          }))}
        />
      </div>
    </>
  );
}
function MethodPanel({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: { key: string; amount: string; count: string; countLabel: string }[];
}) {
  return (
    <section className="border-y border-hairline bg-surface">
      <header className="border-b border-hairline py-5">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </header>
      <dl className="divide-y divide-hairline">
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-2 gap-3 py-4">
            <dt className="font-medium">
              {row.key === 'CASH'
                ? 'Cash'
                : `${row.key === 'GCASH' ? 'GCash' : 'Card'} (manual, unverified)`}
            </dt>
            <dd className="text-right tabular-nums">
              <span className="block break-all">{money(row.amount)}</span>
              <span className="text-xs text-muted">
                {row.count} {row.countLabel}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
