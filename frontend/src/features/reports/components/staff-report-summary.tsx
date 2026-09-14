import { OperationalPanel } from '@/shared/components/ui/operational-page';
import type { StaffSalesReport } from '../model/report.schemas';

export function StaffReportSummary({ report }: { report: StaffSalesReport }) {
  return (
    <>
      {report.transactionCount === '0' ? (
        <p role="status" className="mt-5 text-sm text-muted">
          No completed sales in this branch for the applied period.
        </p>
      ) : null}
      <dl
        aria-label="Sales summary"
        className="mt-6 grid min-w-0 divide-y divide-hairline rounded-panel border border-hairline bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        {[
          ['Gross recorded sales', `PHP ${report.grossSales}`],
          ['Completed transactions', report.transactionCount],
          ['Units sold', report.unitsSold],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 p-5 sm:p-6">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-3 break-all text-xl font-semibold tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <OperationalPanel
        title="Payment summary"
        description="Recorded sale totals, not cash tender, available cash or provider reconciliation. GCash and card payments are manual and unverified."
      >
        <ul
          aria-label="Payment breakdown"
          className="m-0 list-none divide-y divide-hairline p-0"
        >
          {report.payments.map((payment) => (
            <li
              key={payment.paymentMethod}
              className="grid min-w-0 gap-3 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:px-6"
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
    </>
  );
}
