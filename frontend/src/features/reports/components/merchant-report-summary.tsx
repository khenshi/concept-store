import type { MerchantSalesReport } from '../model/report.schemas';

export function MerchantReportSummary({
  report,
}: {
  report: MerchantSalesReport;
}) {
  return (
    <>
      {report.ownTransactionCount === '0' ? (
        <p role="status" className="mt-5 text-sm text-muted">
          No recorded own-item sales in this branch for the applied period. This
          can also occur without a linked merchant profile; ask an owner to
          check your link.
        </p>
      ) : null}
      <dl
        aria-label="Own-sales summary"
        className="mt-6 grid min-w-0 divide-y divide-hairline rounded-panel border border-hairline bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        {[
          ['Own gross recorded sales', `PHP ${report.ownGrossSales}`],
          ['Transactions containing own items', report.ownTransactionCount],
          ['Own units sold', report.ownUnitsSold],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 p-5 sm:p-6">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-3 break-all text-xl font-semibold tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
