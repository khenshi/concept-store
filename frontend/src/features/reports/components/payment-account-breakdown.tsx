'use client';

import { useId, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import {
  OperationalTable,
  OperationalTableFrame,
} from '@/shared/components/ui/operational-table';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import type { StaffSalesReport } from '../model/report.schemas';

type Account = StaffSalesReport['paymentAccounts'][number];
type Metric = 'received' | 'refunded' | 'netReceived';
const metrics: [Metric, string][] = [
  ['received', 'Received'],
  ['refunded', 'Refunded'],
  ['netReceived', 'Net Received'],
];
const cents = (value: string) => BigInt(value.replace('.', ''));
export function accountColor(id: string) {
  const hash = Array.from(id).reduce(
    (value, char) => (value * 31 + char.charCodeAt(0)) >>> 0,
    0,
  );
  return `hsl(${hash % 360} 38% 42%)`;
}
function status(account: Account) {
  return !account.enabled
    ? 'Disabled · Historical'
    : !account.available
      ? 'No longer assigned · Historical'
      : '';
}
function netClass(value: string) {
  const net = cents(value);
  return net < BigInt(0)
    ? 'text-danger'
    : net > BigInt(0)
      ? 'text-success-ink'
      : 'text-ink';
}
function signed(value: string) {
  return cents(value) > BigInt(0) ? `+${value}` : value;
}

export function PaymentAccountBreakdown({
  report,
}: {
  report: Pick<
    StaffSalesReport,
    'paymentAccounts' | 'grossSales' | 'refundedAmount' | 'netRecordedSales'
  >;
}) {
  const rows = report.paymentAccounts;
  const currencyDescriptionId = useId();
  const [metric, setMetric] = useState<Metric>('received');
  const [pagination, setPagination] = useState({ rows, page: 1 });
  const page = pagination.rows === rows ? pagination.page : 1;
  const totalPages = Math.max(1, Math.ceil(rows.length / 15));
  const values = rows.map((row) => cents(row[metric]));
  const negative = values.some((value) => value < BigInt(0));
  const total = values.reduce((sum, value) => sum + value, BigInt(0));
  const maximum = values.reduce((max, value) => {
    const magnitude = value < BigInt(0) ? -value : value;
    return magnitude > max ? magnitude : max;
  }, BigInt(0));
  const label = metrics.find(([key]) => key === metric)![1];
  return (
    <section
      className="data-surface min-w-0"
      aria-label="Payment accounts"
      aria-describedby={currencyDescriptionId}
    >
      <p id={currencyDescriptionId} className="sr-only">
        All amounts are in PHP.
      </p>
      <header className="px-5 py-5 sm:px-6">
        <h2 className="font-semibold">Payment Accounts</h2>
        <p className="mt-1 text-sm text-muted">
          Recorded transaction flows for the selected period and branch. These
          are not verified bank or wallet balances, available cash, or provider
          reconciliation. Opening balances, transfers, withdrawals, expenses,
          fees and settlement timing are excluded.
        </p>
        <div
          role="group"
          aria-label="Payment account metric"
          className="mt-4 flex flex-wrap gap-2"
        >
          {metrics.map(([key, name]) => (
            <Button
              key={key}
              variant={metric === key ? 'primary' : 'quiet'}
              aria-pressed={metric === key}
              onClick={() => setMetric(key)}
            >
              {name}
            </Button>
          ))}
        </div>
      </header>
      {maximum === BigInt(0) ? (
        <EmptyState
          className="m-5"
          title={`No ${label.toLowerCase()} in this period.`}
        />
      ) : negative ? (
        <div
          role="img"
          aria-label={`${label} signed bar chart; zero baseline at center. Exact values follow.`}
          className="space-y-3 px-5 pb-5 sm:px-6"
        >
          {rows.map((row, index) => {
            const value = values[index];
            const magnitude = value < BigInt(0) ? -value : value;
            const width =
              Number((magnitude * BigInt(500000)) / maximum) / 10000;
            return (
              <div key={row.accountId} className="grid gap-1 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>{row.displayName}</span>
                  <span className={`tabular-nums ${netClass(row[metric])}`}>
                    {signed(row[metric])}
                  </span>
                </div>
                <div className="relative h-5 bg-subtle" aria-hidden="true">
                  <span className="absolute inset-y-0 left-1/2 border-l border-ink" />
                  <span
                    className="absolute inset-y-1 rounded-sm"
                    style={{
                      width: `${width}%`,
                      left: `${value < BigInt(0) ? 50 - width : 50}%`,
                      backgroundColor: accountColor(row.accountId),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid justify-items-center gap-4 px-5 pb-5 sm:px-6">
          <svg
            role="img"
            aria-label={`${label} by payment account donut. Exact values follow.`}
            viewBox="0 0 42 42"
            className="size-32 max-w-full -rotate-90"
          >
            <circle
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke="var(--color-hairline)"
              strokeWidth="8"
            />
            {rows.map((row, index) => {
              const share =
                Number((values[index] * BigInt(1000000)) / total) / 10000;
              const start =
                Number(
                  (values
                    .slice(0, index)
                    .reduce((sum, value) => sum + value, BigInt(0)) *
                    BigInt(1000000)) /
                    total,
                ) / 10000;
              return (
                <circle
                  key={row.accountId}
                  cx="21"
                  cy="21"
                  r="15.9155"
                  fill="none"
                  stroke={accountColor(row.accountId)}
                  strokeWidth="8"
                  strokeDasharray={`${share} ${100 - share}`}
                  strokeDashoffset={-start}
                />
              );
            })}
          </svg>
          <dl aria-label={`${label} chart values`} className="w-full space-y-2">
            {rows.map((row) => (
              <div
                key={row.accountId}
                className="flex flex-wrap justify-between gap-3 text-sm"
              >
                <dt className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-sm"
                    style={{ backgroundColor: accountColor(row.accountId) }}
                  />
                  {row.displayName}
                </dt>
                <dd className="tabular-nums">
                  {metric === 'netReceived' ? signed(row[metric]) : row[metric]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <OperationalTableFrame
        footer={
          <PaginationControls
            ariaLabel="Payment accounts pagination"
            currentPage={page}
            totalPages={totalPages}
            hasNext={page < totalPages}
            summary={`${rows.length} accounts`}
            onPrevious={() => setPagination({ rows, page: page - 1 })}
            onNext={() => setPagination({ rows, page: page + 1 })}
          />
        }
      >
        <OperationalTable className="min-w-[38rem] [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle">
          <caption className="sr-only">Exact payment account flows</caption>
          <thead>
            <tr>
              <th scope="col">Account</th>
              <th scope="col">Received</th>
              <th scope="col">Refunded</th>
              <th scope="col">Net Received</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice((page - 1) * 15, page * 15).map((row) => (
              <tr key={row.accountId}>
                <th scope="row" className="break-words">
                  {row.displayName}
                  {status(row) ? (
                    <span className="block text-xs font-normal text-muted">
                      {status(row)}
                    </span>
                  ) : null}
                </th>
                <td className="tabular-nums">{row.received}</td>
                <td className="tabular-nums">{row.refunded}</td>
                <td className={`tabular-nums ${netClass(row.netReceived)}`}>
                  {signed(row.netReceived)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total (all accounts)</th>
              <td>{report.grossSales}</td>
              <td>{report.refundedAmount}</td>
              <td className={netClass(report.netRecordedSales)}>
                {signed(report.netRecordedSales)}
              </td>
            </tr>
          </tfoot>
        </OperationalTable>
      </OperationalTableFrame>
    </section>
  );
}
