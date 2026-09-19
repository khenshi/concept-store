import { OperationalPanel } from '@/shared/components/ui/operational-page';
import type { StaffSalesReport } from '../model/report.schemas';

export function StaffReportSummary({ report }: { report: StaffSalesReport }) {
  return (
    <>
      {report.transactionCount === '0' && report.refundCount === '0' ? (
        <p role="status" className="mt-5 text-sm text-muted">
          No completed sales in this branch for the applied period.
        </p>
      ) : null}
      <dl
        aria-label="Sales summary"
        className="mt-6 grid min-w-0 divide-y divide-hairline border-y border-hairline bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0"
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
        className="mt-5 grid min-w-0 rounded-panel bg-subtle sm:grid-cols-3"
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
      <OperationalPanel
        className="data-surface"
        title="Gross sale payments"
        description="Recorded sale totals, not cash tender, available cash or provider reconciliation. GCash and card payments are manual and unverified."
      >
        <ul aria-label="Payment breakdown" className="m-0 list-none p-0">
          <li
            role="presentation"
            className="data-column-header hidden grid-cols-[minmax(0,1fr)_minmax(12rem,1fr)] gap-x-6 gap-y-3 sm:grid"
          >
            <span>Method</span>
            <span>Recorded amount</span>
          </li>
          {report.payments.map((payment) => (
            <li
              key={payment.paymentMethod}
              className="data-row grid min-w-0 gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,1fr)] sm:items-center"
            >
              <strong className="text-sm font-semibold">
                {payment.paymentMethod === 'CASH'
                  ? 'Cash'
                  : payment.paymentMethod === 'GCASH'
                    ? 'GCash (manual, unverified)'
                    : 'Card (manual, unverified)'}
              </strong>
              <div className="min-w-0 break-all text-sm tabular-nums">
                <p>Gross sales: PHP {payment.grossSales}</p>
                <p className="mt-1 text-muted">
                  Transactions: {payment.transactionCount}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </OperationalPanel>
      <OperationalPanel
        className="data-surface"
        title="Actual refund methods"
        description="Separate manual refund amounts, not netted against sale payments. The refund method may differ from the original payment. No provider processing or verification."
      >
        <ul aria-label="Refund method breakdown" className="m-0 list-none p-0">
          <li
            role="presentation"
            className="data-column-header hidden grid-cols-2 gap-x-6 gap-y-3 sm:grid"
          >
            <span>Method</span>
            <span>Recorded amount</span>
          </li>
          {report.refundMethods.map((row) => (
            <li
              key={row.paymentMethod}
              className="data-row grid min-w-0 gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-2 sm:items-center"
            >
              <strong>
                {row.paymentMethod === 'CASH'
                  ? 'Cash refunds'
                  : row.paymentMethod === 'GCASH'
                    ? 'GCash refunds (manual)'
                    : 'Card refunds (manual)'}
              </strong>
              <div className="min-w-0 break-all text-sm tabular-nums">
                <p>Refunded: PHP {row.refundedAmount}</p>
                <p>Refunds: {row.refundCount}</p>
              </div>
            </li>
          ))}
        </ul>
      </OperationalPanel>
    </>
  );
}
