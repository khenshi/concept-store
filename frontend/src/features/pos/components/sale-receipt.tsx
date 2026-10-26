'use client';

import { createPortal } from 'react-dom';
import { useState, type ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import type { CompletedSale } from '../model/checkout';

function ReceiptContent({ sale }: { sale: CompletedSale }) {
  return (
    <article className="min-w-0 break-words text-ink">
      <header className="border-b border-hairline pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-xl font-semibold">{sale.organizationName}</h3>
            <p className="mt-1 text-sm text-muted">
              {sale.branchName}
              {sale.branchCode ? ` · ${sale.branchCode}` : ''}
            </p>
          </div>
          <div className="min-w-0 sm:text-right">
            <p className="font-semibold">Receipt {sale.receiptCode}</p>
            <time
              className="mt-1 block text-sm text-muted"
              dateTime={sale.completedAt}
            >
              {new Date(sale.completedAt).toLocaleString()}
            </time>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted">
          Cashier:{' '}
          <span className="font-medium text-ink">{sale.cashierName}</span>
        </p>
      </header>
      <section className="mt-5" aria-label="Purchased items">
        <div className="flex items-baseline justify-between gap-4">
          <h4 className="font-semibold">Purchased items</h4>
          <span className="text-xs text-muted">
            {sale.items.length} {sale.items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="mt-3 hidden grid-cols-[minmax(0,1fr)_8rem_8rem] gap-4 border-b border-hairline px-3 pb-2 text-xs font-medium text-muted sm:grid">
          <span>Product</span>
          <span>Qty × price</span>
          <span>Line total</span>
        </div>
        <ul className="divide-y divide-hairline">
          {sale.items.map((item) => (
            <li
              key={item.id}
              className="grid gap-2 px-3 py-4 sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:items-start sm:gap-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">{item.productName}</p>
                <p className="mt-1 text-sm text-muted">
                  {item.merchantName} · SKU {item.sku ?? 'not set'} · Barcode{' '}
                  {item.barcode ?? 'not set'}
                </p>
              </div>
              <p className="text-sm tabular-nums text-muted">
                {item.quantity} × PHP {item.unitPrice}
              </p>
              <p className="font-semibold tabular-nums">
                <span className="sm:hidden">Line total: </span>PHP{' '}
                {item.lineTotal}
              </p>
            </li>
          ))}
        </ul>
      </section>
      <section
        className="mt-5 grid gap-5 border-t border-hairline pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)]"
        aria-label="Payment summary"
      >
        <div>
          <h4 className="font-semibold">Payment</h4>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex flex-wrap justify-between gap-x-4">
              <dt className="text-muted">Payment account</dt>
              <dd className="font-medium">{sale.paymentAccountName}</dd>
            </div>
            {sale.paymentAccountIsCash ? (
              <>
                <div className="flex flex-wrap justify-between gap-x-4">
                  <dt className="text-muted">Cash tender</dt>
                  <dd className="tabular-nums">PHP {sale.cashTender}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-4">
                  <dt className="text-muted">Change</dt>
                  <dd className="tabular-nums">PHP {sale.cashChange}</dd>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap justify-between gap-x-4">
                  <dt className="text-muted">Reference</dt>
                  <dd className="break-words text-right">
                    {sale.paymentReference ?? '—'}
                  </dd>
                </div>
                <div className="text-xs text-muted">
                  Manually recorded payment · unverified by provider
                </div>
              </>
            )}
          </dl>
        </div>
        <div className="sm:text-right">
          <p className="text-sm text-muted">Total</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            PHP {sale.total}
          </p>
        </div>
      </section>
      <p className="mt-5 rounded-control bg-subtle px-4 py-3 text-sm text-muted">
        Internal transaction record only. Not a fiscal/tax invoice.
      </p>
    </article>
  );
}
export function SaleReceipt({
  sale,
  renderActions,
}: {
  sale: CompletedSale;
  renderActions?: (actions: {
    printButton: ReactNode;
    feedback: ReactNode;
  }) => ReactNode;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const printButton = (
    <Button
      variant="primary"
      onClick={() => {
        try {
          window.print();
          setFeedback(
            'Print dialog requested. If cancelled or unsuccessful, print this saved receipt again; checkout will not repeat.',
          );
        } catch {
          setFeedback(
            'Printing could not be opened. Try printing this saved receipt again; the sale is already completed.',
          );
        }
      }}
    >
      Print
    </Button>
  );
  const printFeedback = feedback ? (
    <p role="status" className="text-sm text-muted">
      {feedback}
    </p>
  ) : null;
  return (
    <>
      <ReceiptContent sale={sale} />
      {renderActions ? (
        renderActions({ printButton, feedback: printFeedback })
      ) : (
        <>
          <div className="mt-5 flex justify-end">{printButton}</div>
          {printFeedback ? <div className="mt-3">{printFeedback}</div> : null}
        </>
      )}
      {createPortal(
        <div id="pos-receipt-print-root" aria-hidden="true">
          <style>{`#pos-receipt-print-root { display: none; } @media print { body > *:not(#pos-receipt-print-root) { display: none !important; } #pos-receipt-print-root { display: block !important; padding: 12mm; background: white; color: black; } body { overflow: visible !important; } @page { margin: 8mm; } }`}</style>
          <ReceiptContent sale={sale} />
        </div>,
        document.body,
      )}
    </>
  );
}
