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
        className="mt-5 grid min-w-0 divide-y divide-hairline border-y border-hairline bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        {[
          ['Refunded amount', report.refundedAmount],
          ['Net recorded sales', report.netRecordedSales],
        ].map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 py-5 sm:px-5 sm:py-6 first:sm:pl-0"
          >
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-3 break-all text-xl font-semibold tabular-nums">
              <span>PHP </span>
              <span>{value}</span>
            </dd>
          </div>
        ))}
        <div className="min-w-0 py-5 sm:px-5 sm:py-6 sm:pr-0">
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
        variant="open"
        title="Gross sale payments"
        description="Recorded sale totals, not cash tender, available cash or provider reconciliation. GCash and card payments are manual and unverified."
      >
        <ul
          aria-label="Payment breakdown"
          className="m-0 list-none divide-y divide-hairline p-0"
        >
          {report.payments.map((payment) => (
            <li
              key={payment.paymentMethod}
              className="grid min-w-0 gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
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
        variant="open"
        title="Actual refund methods"
        description="Separate manual refund amounts, not netted against sale payments. The refund method may differ from the original payment. No provider processing or verification."
      >
        <ul
          aria-label="Refund method breakdown"
          className="divide-y divide-hairline"
        >
          {report.refundMethods.map((row) => (
            <li
              key={row.paymentMethod}
              className="grid min-w-0 gap-3 py-5 sm:grid-cols-2 sm:py-6"
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
