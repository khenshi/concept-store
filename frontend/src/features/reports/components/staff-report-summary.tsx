import { PaymentAccountBreakdown } from './payment-account-breakdown';
import { EmptyState } from '@/shared/components/ui/empty-state';
import type { StaffSalesReport } from '../model/report.schemas';

export function StaffReportSummary({ report }: { report: StaffSalesReport }) {
  return (
    <>
      {report.transactionCount === '0' && report.refundCount === '0' ? (
        <EmptyState
          className="mt-5"
          title="No completed sales in this branch for the applied period."
        />
      ) : null}
      <dl
        aria-label="Sales summary"
        className="mt-5 grid min-w-0 divide-y divide-hairline card-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        {[
          ['Gross recorded sales', `PHP ${report.grossSales}`],
          ['Completed transactions', report.transactionCount],
          ['Units sold', report.unitsSold],
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
        aria-label="Refund and net summary"
        className="mt-5 grid min-w-0 card-surface sm:grid-cols-3"
      >
        {[
          ['Refunded amount', report.refundedAmount],
          ['Net recorded sales', report.netRecordedSales],
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
            Completed refunds / returned units
          </dt>
          <dd className="mt-3 text-xl font-semibold tabular-nums">
            {report.refundCount} / {report.returnedUnits}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-muted">
        Gross sales use sale completion dates. Refunds use refund processing
        dates, even for older sales. Net is gross minus refunds and can be
        negative; it is not profit or available cash. Sale counts and units sold
        remain gross.
      </p>
      <PaymentAccountBreakdown report={report} />
    </>
  );
}
