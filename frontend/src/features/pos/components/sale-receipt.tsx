'use client';

import { createPortal } from 'react-dom';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import type { CompletedSale } from '../model/checkout';

function ReceiptContent({ sale }: { sale: CompletedSale }) {
  return (
    <article className="min-w-0 break-words text-ink">
      <h3 className="text-xl font-semibold">{sale.organizationName}</h3>
      <p>
        {sale.branchName}
        {sale.branchCode ? ` · ${sale.branchCode}` : ''}
      </p>
      <p className="mt-3 font-semibold">Receipt {sale.receiptCode}</p>
      <p>{new Date(sale.completedAt).toLocaleString()}</p>
      <p>Cashier: {sale.cashierName}</p>
      <ul className="my-5 divide-y divide-hairline">
        {sale.items.map((item) => (
          <li key={item.id} className="py-3 break-inside-avoid">
            <p className="font-semibold">{item.productName}</p>
            <p className="text-sm">
              {item.merchantName} · SKU {item.sku ?? 'not set'} · Barcode{' '}
              {item.barcode ?? 'not set'}
            </p>
            <p className="tabular-nums">
              {item.quantity} × PHP {item.unitPrice} = PHP {item.lineTotal}
            </p>
          </li>
        ))}
      </ul>
      <p className="font-semibold tabular-nums">Total: PHP {sale.total}</p>
      <p>
        Payment:{' '}
        {sale.paymentMethod === 'GCASH'
          ? 'GCash'
          : sale.paymentMethod === 'CARD'
            ? 'Card'
            : 'Cash'}
      </p>
      {sale.paymentMethod === 'CASH' ? (
        <>
          <p>Cash tender: PHP {sale.cashTender}</p>
          <p>Change: PHP {sale.cashChange}</p>
        </>
      ) : (
        <>
          <p className="break-words">Reference: {sale.paymentReference}</p>
          <p className="text-sm">
            Manually recorded payment · unverified by provider
          </p>
        </>
      )}
      <p className="mt-5 text-sm">
        Internal transaction record only. Not a fiscal/tax invoice.
      </p>
    </article>
  );
}
export function SaleReceipt({ sale }: { sale: CompletedSale }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  return (
    <>
      <ReceiptContent sale={sale} />
      <Button
        className="mt-5"
        variant="secondary"
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
        Print internal receipt
      </Button>
      {feedback ? (
        <p role="status" className="mt-3 text-sm text-muted">
          {feedback}
        </p>
      ) : null}
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
