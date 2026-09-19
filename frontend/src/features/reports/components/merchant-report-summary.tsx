import type { MerchantSalesReport } from '../model/report.schemas';

export function MerchantReportSummary({
  report,
}: {
  report: MerchantSalesReport;
}) {
  return (
    <>
      {report.ownTransactionCount === '0' && report.ownRefundCount === '0' ? (
        <p role="status" className="mt-5 text-sm text-muted">
          No recorded own-item sales in this branch for the applied period. This
          can also occur without a linked merchant profile; ask an owner to
          check your link.
        </p>
      ) : null}
      <dl
        aria-label="Own-sales summary"
        className="mt-6 grid min-w-0 divide-y divide-hairline border-y border-hairline bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        {[
          ['Own gross recorded sales', `PHP ${report.ownGrossSales}`],
          ['Transactions containing own items', report.ownTransactionCount],
          ['Own units sold', report.ownUnitsSold],
        ].map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 py-5 sm:px-5 sm:py-6 first:sm:pl-0 last:sm:pr-0"
          >
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-3 break-all text-xl font-semibold tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <dl
        aria-label="Own refund and net summary"
        className="mt-5 grid min-w-0 rounded-panel bg-subtle sm:grid-cols-3"
      >
        {[
          ['Own refunded amount', report.ownRefundedAmount],
          ['Own net recorded sales', report.ownNetRecordedSales],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 px-5 py-5 sm:py-6">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-3 break-all text-xl font-semibold tabular-nums">
              <span>PHP </span>
              <span>{value}</span>
            </dd>
          </div>
        ))}
        <div className="min-w-0 px-5 py-5 sm:py-6">
          <dt className="text-sm text-muted">
            Refunds containing own items / own returned units
          </dt>
          <dd className="mt-3 text-xl font-semibold tabular-nums">
            {report.ownRefundCount} / {report.ownReturnedUnits}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-muted">
        Only your current linked business’s historical items are included. Gross
        uses sale dates; refunds use refund processing dates, even for older
        sales. Own net is own gross minus own refunds and may be negative, not a
        payout or profit.
      </p>
    </>
  );
}
