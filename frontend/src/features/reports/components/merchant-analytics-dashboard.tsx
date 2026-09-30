import { useState } from 'react';
import { buttonStyles } from '@/shared/components/ui/button';
import { RequestError } from '@/shared/components/ui/request-error';
import type {
  ReportRankingControls,
  MerchantSalesAnalytics,
  MerchantSalesRankingPage,
} from '../model/report.schemas';
import {
  AnalyticsTrendCharts,
  ReportSummary,
  RankingControls,
} from './staff-analytics-dashboard';
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
          Exact own daily sales analytics in Asia/Manila.
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
            onClick={() => setPageState({ rows, page: Math.max(1, page - 1) })}
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
  controls,
  onControlsChange,
}: {
  page: MerchantSalesRankingPage | null;
  loading: boolean;
  error: string | null;
  errorPage: number | null;
  onPageChange(page: number): void;
  controls: ReportRankingControls;
  onControlsChange: (controls: ReportRankingControls) => void;
}) {
  const title =
    controls.sortBy === 'UNITS_SOLD'
      ? 'Your top products by units sold'
      : 'Your top products by gross sales';
  const sortLabel =
    controls.sortBy === 'UNITS_SOLD' ? 'Units sold' : 'Gross sales';
  return (
    <section
      className="data-surface"
      role="tabpanel"
      id="sales-rankings-panel"
      aria-labelledby="sales-report-tab-rankings"
      tabIndex={0}
    >
      <header className="grid gap-4 border-b border-hairline py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted">
            Product rankings by {sortLabel}.
          </p>
        </div>
        <RankingControls
          controls={controls}
          showMerchantFilter={false}
          onChange={onControlsChange}
        />
      </header>
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
        <div className="overflow-x-auto">
          <table
            aria-label={title}
            className="data-table w-full min-w-[44rem] border-collapse text-left text-sm xl:min-w-[60rem]"
          >
            <thead className="border-b border-hairline bg-surface text-xs uppercase tracking-[0.08em] text-muted">
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
                <th scope="col">Saved merchant</th>
                <th
                  scope="col"
                  aria-sort={
                    controls.sortBy === 'UNITS_SOLD' ? 'descending' : undefined
                  }
                  className={
                    controls.sortBy === 'UNITS_SOLD'
                      ? 'font-semibold text-ink'
                      : ''
                  }
                >
                  Own units sold
                </th>
                <th
                  scope="col"
                  aria-sort={
                    controls.sortBy === 'GROSS_SALES' ? 'descending' : undefined
                  }
                  className={
                    controls.sortBy === 'GROSS_SALES'
                      ? 'font-semibold text-ink'
                      : ''
                  }
                >
                  Own gross
                </th>
                <th scope="col" className="font-semibold text-ink">
                  Own net recorded
                </th>
                <th scope="col" className="hidden xl:table-cell">
                  SKU / barcode
                </th>
                <th scope="col" className="hidden xl:table-cell">
                  Own returned
                </th>
                <th scope="col" className="hidden xl:table-cell">
                  Own refunded
                </th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((row, index) => (
                <tr key={row.productId}>
                  <td className="sticky left-0 z-10 w-12 bg-surface px-3 py-4 tabular-nums">
                    {(page.page - 1) * page.limit + index + 1}
                  </td>
                  <th
                    scope="row"
                    className="sticky left-12 z-10 min-w-56 max-w-64 bg-surface px-4 py-4 font-semibold"
                  >
                    <span className="block break-words">{row.productName}</span>
                    <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs font-normal leading-5 text-muted xl:hidden">
                      <span>SKU {row.sku ?? '—'}</span>
                      <span>Barcode {row.barcode ?? '—'}</span>
                      <span>Returned {row.ownReturnedUnits}</span>
                      <span>Refunded {money(row.ownRefundedAmount)}</span>
                    </span>
                  </th>
                  <td className="max-w-48 break-words px-4 py-4">
                    {row.merchantName}
                  </td>
                  <td
                    className={`px-4 py-4 tabular-nums ${controls.sortBy === 'UNITS_SOLD' ? 'font-semibold text-ink' : ''}`}
                  >
                    {row.ownUnitsSold}
                  </td>
                  <td
                    className={`px-4 py-4 tabular-nums ${controls.sortBy === 'GROSS_SALES' ? 'font-semibold text-ink' : ''}`}
                  >
                    {money(row.ownGrossSales)}
                  </td>
                  <td className="px-4 py-4 font-semibold tabular-nums text-ink">
                    {money(row.ownNetRecordedSales)}
                  </td>
                  <td className="hidden px-4 py-4 xl:table-cell">
                    {row.sku ?? '—'} / {row.barcode ?? '—'}
                  </td>
                  <td className="hidden px-4 py-4 tabular-nums xl:table-cell">
                    {row.ownReturnedUnits}
                  </td>
                  <td className="hidden px-4 py-4 tabular-nums xl:table-cell">
                    {money(row.ownRefundedAmount)}
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
      {page && page.totalProducts !== '0' ? (
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
  rankingControls = { sortBy: 'GROSS_SALES', merchantId: null },
  onRankingControlsChange = () => undefined,
  rankingLoading = false,
  rankingError = null,
  rankingErrorPage = null,
  onRankingPageChange = () => undefined,
}: {
  report: MerchantSalesAnalytics;
  activeTab?: SalesReportTab;
  ranking?: MerchantSalesRankingPage;
  rankingControls?: ReportRankingControls;
  onRankingControlsChange?: (controls: ReportRankingControls) => void;
  rankingLoading?: boolean;
  rankingError?: string | null;
  rankingErrorPage?: number | null;
  onRankingPageChange?: (page: number) => void;
}) {
  const initialRanking: MerchantSalesRankingPage = {
    scope: 'MERCHANT',
    branch: report.branch,
    from: report.from,
    until: report.until,
    sortBy: 'GROSS_SALES',
    merchantId: null,
    page: 1,
    limit: 10,
    totalProducts: report.totalProducts,
    hasNext: BigInt(10) < BigInt(report.totalProducts),
    items: report.topProducts,
  };
  const isDefaultRanking =
    rankingControls.sortBy === 'GROSS_SALES' &&
    rankingControls.merchantId === null;
  const displayedRanking =
    ranking ?? (isDefaultRanking && !rankingLoading ? initialRanking : null);
  if (activeTab === 'daily')
    return <MerchantDailyData rows={report.dailyTrends} />;
  if (activeTab === 'rankings')
    return (
      <MerchantRankings
        page={displayedRanking}
        loading={rankingLoading}
        error={rankingError}
        errorPage={rankingErrorPage}
        onPageChange={onRankingPageChange}
        controls={rankingControls}
        onControlsChange={onRankingControlsChange}
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
      <ReportSummary
        ariaLabel="Own-sales analytics summary"
        primary={{
          label: 'Own net recorded sales',
          value: money(report.ownNetRecordedSales),
          detail: 'Own gross minus own refunds',
        }}
        supporting={[
          {
            label: 'Own gross recorded sales',
            value: money(report.ownGrossSales),
            detail: 'Your historical items only',
          },
          {
            label: 'Own refunded amount',
            value: money(report.ownRefundedAmount),
            detail: `${report.ownRefundCount} matching refunds`,
          },
          {
            label: 'Transactions with own items',
            value: report.ownTransactionCount,
            detail: `${report.ownUnitsSold} own units sold`,
          },
        ]}
      />
      <p className="mt-4 max-w-2xl text-xs leading-5 text-muted">
        Own returned units: {report.ownReturnedUnits}. Net is not profit or
        payout; figures exclude other merchants’ items.
      </p>
      <section
        aria-labelledby="own-sales-trends-heading"
        className="mt-8 border-t border-hairline pt-8"
      >
        <div className="max-w-2xl">
          <h2 id="own-sales-trends-heading" className="text-base font-semibold">
            Sales trends
          </h2>
          <p className="mt-1 text-sm text-muted">
            Your gross sales, refunds, and net recorded sales over time.
          </p>
        </div>
        <AnalyticsTrendCharts
          rows={trends}
          own
          className="mt-5 grid gap-6 xl:grid-cols-2"
        />
      </section>
    </div>
  );
}
