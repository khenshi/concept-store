import { useState, type ReactNode } from 'react';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { OperationalCollection } from '@/shared/components/ui/operational-page';
import {
  OperationalTable,
  OperationalTableFrame,
} from '@/shared/components/ui/operational-table';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
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
import type {
  ChartGranularity,
  SalesReportTab,
} from './staff-analytics-dashboard';

const money = (value: string) => `PHP ${value}`;

export function MerchantDailyData({
  rows,
  pagination,
}: {
  rows: MerchantSalesAnalytics['dailyTrends'];
  pagination?: ReactNode;
}) {
  const [pageState, setPageState] = useState<{
    rows: MerchantSalesAnalytics['dailyTrends'];
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
      title="Daily own-sales data"
      description="Exact own daily sales analytics in Asia/Manila."
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
              Daily own-sales data in Asia/Manila
            </caption>
            <thead className="text-xs uppercase tracking-[0.08em] text-muted [&_th]:font-normal">
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
            <tbody className="text-sm font-normal text-ink">
              {pageRows.map((row) => (
                <tr key={row.date}>
                  <th scope="row" className="px-4 py-3 font-semibold">
                    {row.date}
                  </th>
                  {[
                    row.ownGrossSales,
                    row.ownTransactionCount,
                    row.ownUnitsSold,
                    row.ownRefundedAmount,
                    row.ownRefundCount,
                    row.ownReturnedUnits,
                  ].map((value, index) => (
                    <td key={index} className="px-4 py-3 tabular-nums">
                      {value}
                    </td>
                  ))}
                  <td
                    className={`px-4 py-3 tabular-nums ${Number(row.ownNetRecordedSales) > 0 ? 'text-success-ink' : Number(row.ownNetRecordedSales) < 0 ? 'text-danger' : 'text-ink'}`}
                  >
                    {Number(row.ownNetRecordedSales) > 0 ? '+' : ''}
                    {row.ownNetRecordedSales}
                  </td>
                </tr>
              ))}
            </tbody>
          </OperationalTable>
        ) : undefined}
      </OperationalTableFrame>
    </OperationalCollection>
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
    <OperationalCollection
      surface="data"
      role="tabpanel"
      id="sales-rankings-panel"
      aria-labelledby="sales-report-tab-rankings"
      tabIndex={0}
      title={title}
      description={`Product rankings by ${sortLabel}.`}
      controlsPlacement="inline"
      controls={
        <RankingControls
          controls={controls}
          showMerchantFilter={false}
          onChange={onControlsChange}
        />
      }
    >
      <OperationalTableFrame
        empty={
          page && !loading && !error && !page.items.length ? (
            <EmptyState
              className="mt-6"
              title="No own products contributed sales or refunds in this period."
              description="In an assigned branch, a missing merchant-profile link can also result in zeros."
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
            className="min-w-[44rem] xl:min-w-[60rem]"
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
                <th scope="col">Saved merchant</th>
                <th
                  scope="col"
                  aria-sort={
                    controls.sortBy === 'UNITS_SOLD' ? 'descending' : undefined
                  }
                >
                  Own units sold
                </th>
                <th
                  scope="col"
                  aria-sort={
                    controls.sortBy === 'GROSS_SALES' ? 'descending' : undefined
                  }
                >
                  Own gross
                </th>
                <th scope="col">
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
                      <span>Returned {row.ownReturnedUnits}</span>
                      <span>Refunded {row.ownRefundedAmount}</span>
                    </span>
                  </th>
                  <td className="max-w-48 break-words px-4 py-4">
                    {row.merchantName}
                  </td>
                  <td className="px-4 py-4 tabular-nums">
                    {row.ownUnitsSold}
                  </td>
                  <td className="px-4 py-4 tabular-nums">
                    {row.ownGrossSales}
                  </td>
                  <td className="px-4 py-4 tabular-nums">
                    {row.ownNetRecordedSales}
                  </td>
                  <td className="hidden px-4 py-4 xl:table-cell">
                    {row.sku ?? '—'} / {row.barcode ?? '—'}
                  </td>
                  <td className="hidden px-4 py-4 tabular-nums xl:table-cell">
                    {row.ownReturnedUnits}
                  </td>
                  <td className="hidden px-4 py-4 tabular-nums xl:table-cell">
                    {row.ownRefundedAmount}
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

export function MerchantAnalyticsDashboard({
  report,
  granularity = report.granularity ?? 'DAY',
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
  granularity?: ChartGranularity;
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
          granularity={granularity}
          own
          className="mt-5 grid gap-6 xl:grid-cols-2"
        />
      </section>
    </div>
  );
}
