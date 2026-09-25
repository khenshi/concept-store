import { useState } from 'react';
import { buttonStyles } from '@/shared/components/ui/button';
import { RequestError } from '@/shared/components/ui/request-error';
import type {
  MerchantSalesAnalytics,
  MerchantSalesRankingPage,
} from '../model/report.schemas';
import { AnalyticsTrendCharts } from './staff-analytics-dashboard';
import type { SalesReportTab } from './staff-analytics-dashboard';

const money = (value: string) => `PHP ${value}`;

function MerchantDailyData({
  rows,
}: {
  rows: MerchantSalesAnalytics['dailyTrends'];
}) {
  const [pageState, setPageState] = useState<{
    rows: MerchantSalesAnalytics['dailyTrends'];
    page: number;
  }>({ rows, page: 1 });
  const page = pageState.rows === rows ? pageState.page : 1;
  const pageRows = rows.slice((page - 1) * 10, page * 10);
  const hasNext = page * 10 < rows.length;
  return (
    <section
      className="data-surface"
      role="tabpanel"
      id="sales-daily-panel"
      aria-labelledby="sales-report-tab-daily"
      tabIndex={0}
    >
      <header className="border-b border-hairline px-5 py-5 sm:px-6">
        <h2 className="font-semibold">Daily own-sales data</h2>
        <p className="mt-1 text-sm text-muted">
          Exact own daily sales analytics in Asia/Manila. Ten rows per page.
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="data-table w-full min-w-[50rem] border-collapse text-left text-sm">
          <caption className="sr-only">
            Daily own-sales data in Asia/Manila
          </caption>
          <thead className="text-xs uppercase tracking-[0.08em] text-muted">
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
                <th key={value} scope="col">
                  {value}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-4 sm:px-6">
        <p className="text-sm text-muted">Page {page}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={buttonStyles({ variant: 'quiet' })}
            disabled={page === 1}
            onClick={() =>
              setPageState({ rows, page: Math.max(1, page - 1) })
            }
          >
            Previous
          </button>
          <button
            type="button"
            className={buttonStyles({ variant: 'secondary' })}
            disabled={!hasNext}
            onClick={() => setPageState({ rows, page: page + 1 })}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function MerchantRankings({
  page,
  loading,
  error,
  errorPage,
  onPageChange,
}: {
  page: MerchantSalesRankingPage;
  loading: boolean;
  error: string | null;
  errorPage: number | null;
  onPageChange(page: number): void;
}) {
  return (
    <section
      className="data-surface"
      role="tabpanel"
      id="sales-rankings-panel"
      aria-labelledby="sales-report-tab-rankings"
      tabIndex={0}
    >
      <header className="border-b border-hairline px-5 py-5 sm:px-6">
        <h2 className="font-semibold">Your top products by gross sales</h2>
        <p className="mt-1 text-sm text-muted">
          Page {page.page} of own saved product rankings. Ten rows per page;
          saved sale identity, not current catalog or inventory.
        </p>
      </header>
      {error && errorPage !== null ? (
        <RequestError
          className="p-5 sm:p-6"
          message={error}
          onRetry={() => onPageChange(errorPage)}
        />
      ) : page.items.length ? (
        <div className="overflow-x-auto">
          <table
            aria-label="Own top products by gross sales"
            className="data-table w-full min-w-[60rem] border-collapse text-left text-sm"
          >
            <thead className="text-xs uppercase tracking-[0.08em] text-muted">
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
                  <th key={value} scope="col">
                    {value}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {page.items.map((row, index) => (
                <tr key={row.productId}>
                  <td className="px-4 py-4 tabular-nums">
                    {(page.page - 1) * page.limit + index + 1}
                  </td>
                  <th scope="row" className="max-w-64 px-4 py-4 font-semibold">
                    <span className="block break-words">{row.productName}</span>
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
                  <td className="px-4 py-4 tabular-nums">{row.ownUnitsSold}</td>
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
        <p role="status" className="px-5 py-6 text-sm text-muted sm:px-6">
          No own products contributed sales or refunds in this period. In an
          assigned branch, a missing merchant-profile link can also result in
          zeros.
        </p>
      )}
      {page.totalProducts !== '0' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-4 sm:px-6">
          <p className="text-sm text-muted">
            Page {page.page} · {page.totalProducts} total products
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={buttonStyles({ variant: 'quiet' })}
              disabled={loading || page.page === 1}
              onClick={() => onPageChange(page.page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className={buttonStyles({ variant: 'secondary' })}
              disabled={loading || !page.hasNext}
              onClick={() => onPageChange(page.page + 1)}
            >
              {loading ? 'Loading…' : 'Next'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function MerchantAnalyticsDashboard({
  report,
  activeTab = 'overview',
  ranking,
  rankingLoading = false,
  rankingError = null,
  rankingErrorPage = null,
  onRankingPageChange = () => undefined,
}: {
  report: MerchantSalesAnalytics;
  activeTab?: SalesReportTab;
  ranking?: MerchantSalesRankingPage;
  rankingLoading?: boolean;
  rankingError?: string | null;
  rankingErrorPage?: number | null;
  onRankingPageChange?: (page: number) => void;
}) {
  const initialRanking: MerchantSalesRankingPage = ranking ?? {
    scope: 'MERCHANT',
    branch: report.branch,
    from: report.from,
    until: report.until,
    page: 1,
    limit: 10,
    totalProducts: report.totalProducts,
    hasNext: BigInt(10) < BigInt(report.totalProducts),
    items: report.topProducts,
  };
  if (activeTab === 'daily')
    return <MerchantDailyData rows={report.dailyTrends} />;
  if (activeTab === 'rankings')
    return (
      <MerchantRankings
        page={initialRanking}
        loading={rankingLoading}
        error={rankingError}
        errorPage={rankingErrorPage}
        onPageChange={onRankingPageChange}
      />
    );
  const trends = report.dailyTrends.map((row) => ({
    date: row.date,
    grossSales: row.ownGrossSales,
    refundedAmount: row.ownRefundedAmount,
    netRecordedSales: row.ownNetRecordedSales,
  }));
  return (
    <div
      role="tabpanel"
      id="sales-overview-panel"
      aria-labelledby="sales-report-tab-overview"
      tabIndex={0}
    >
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
    </div>
  );
}
