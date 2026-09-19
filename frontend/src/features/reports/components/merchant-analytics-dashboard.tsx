import type { MerchantSalesAnalytics } from '../model/report.schemas';
import { AnalyticsTrendCharts } from './staff-analytics-dashboard';

const money = (value: string) => `PHP ${value}`;

export function MerchantAnalyticsDashboard({
  report,
}: {
  report: MerchantSalesAnalytics;
}) {
  const empty =
    report.ownTransactionCount === '0' && report.ownRefundCount === '0';
  const trends = report.dailyTrends.map((row) => ({
    date: row.date,
    grossSales: row.ownGrossSales,
    refundedAmount: row.ownRefundedAmount,
    netRecordedSales: row.ownNetRecordedSales,
  }));
  return (
    <>
      {empty ? (
        <p role="status" className="mt-5 text-sm text-muted">
          No completed sales or refunds involving your currently linked merchant
          profile in this branch for the applied period.
        </p>
      ) : null}
      <dl
        aria-label="Own-sales analytics summary"
        className="mt-6 grid gap-y-2 border-y border-hairline sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          [
            'Own gross recorded sales',
            money(report.ownGrossSales),
            'Your historical items only',
          ],
          [
            'Own refunded amount',
            money(report.ownRefundedAmount),
            `${report.ownRefundCount} matching refunds`,
          ],
          [
            'Own net recorded sales',
            money(report.ownNetRecordedSales),
            'Own gross minus own refunds',
          ],
          [
            'Transactions with own items',
            report.ownTransactionCount,
            `${report.ownUnitsSold} own units sold`,
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
        Own returned units: {report.ownReturnedUnits}. Own net is not profit or
        payout. Refunds use their own completion dates. Figures never include
        other merchants’ items.
      </p>
      <AnalyticsTrendCharts rows={trends} own />
      <details className="data-surface mt-4">
        <summary className="min-h-11 cursor-pointer px-5 py-3 text-sm font-semibold sm:px-6">
          View exact own daily data
        </summary>
        <div className="overflow-x-auto border-t border-hairline">
          <table className="data-table w-full min-w-[50rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Exact own daily sales analytics in Asia/Manila
            </caption>
            <thead className="bg-subtle text-xs uppercase tracking-[0.08em] text-muted">
              <tr>
                {[
                  'Date',
                  'Own gross',
                  'Transactions with own items',
                  'Own units sold',
                  'Own refunded',
                  'Matching refunds',
                  'Own returned units',
                  'Own net recorded',
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
                    money(row.ownGrossSales),
                    row.ownTransactionCount,
                    row.ownUnitsSold,
                    money(row.ownRefundedAmount),
                    row.ownRefundCount,
                    row.ownReturnedUnits,
                    money(row.ownNetRecordedSales),
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
          <h2 className="font-semibold">Your top products by gross sales</h2>
          <p className="mt-1 text-sm text-muted">
            Top {report.topProducts.length} of {report.totalProducts} own
            contributing products. Saved sale identity, not current catalog or
            inventory.
          </p>
        </header>
        {report.topProducts.length ? (
          <div className="overflow-x-auto">
            <table
              aria-label="Own top products by gross sales"
              className="data-table w-full min-w-[60rem] border-collapse text-left text-sm"
            >
              <thead className="bg-subtle text-xs uppercase tracking-[0.08em] text-muted">
                <tr>
                  {[
                    'Rank',
                    'Product',
                    'SKU / barcode',
                    'Saved merchant',
                    'Own units sold',
                    'Own gross',
                    'Own returned',
                    'Own refunded',
                    'Own net recorded',
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
                    <td className="px-4 py-4 tabular-nums">
                      {row.ownUnitsSold}
                    </td>
                    <td className="px-4 py-4 tabular-nums">
                      {money(row.ownGrossSales)}
                    </td>
                    <td className="px-4 py-4 tabular-nums">
                      {row.ownReturnedUnits}
                    </td>
                    <td className="px-4 py-4 tabular-nums">
                      {money(row.ownRefundedAmount)}
                    </td>
                    <td className="px-4 py-4 tabular-nums">
                      {money(row.ownNetRecordedSales)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-5 text-sm text-muted">
            No own products contributed sales or refunds in this period. In an
            assigned branch, a missing merchant-profile link can also result in
            zeros.
          </p>
        )}
      </section>
    </>
  );
}
