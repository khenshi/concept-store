'use client';

import { useEffect, useRef } from 'react';
import type { Sale } from './pos.types';

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

export function SaleCompleteModal({
  sale,
  onNewSale,
}: {
  sale: Sale;
  onNewSale(): void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4">
      <section
        className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-complete-title"
      >
        <span className="grid size-11 place-items-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700">
          ✓
        </span>
        <h2
          className="mt-4 text-2xl font-bold tracking-[-0.03em] text-slate-950"
          id="sale-complete-title"
          ref={headingRef}
          tabIndex={-1}
        >
          Sale completed
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {sale.saleNumber} was recorded at {sale.branch.name}.
        </p>
        <dl className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200">
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-slate-500">Total paid</dt>
            <dd className="font-bold text-slate-950">
              {money.format(Number(sale.total))}
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-slate-500">Payment</dt>
            <dd className="text-sm font-bold text-slate-950">
              {sale.payments.map((payment) => payment.method).join(', ')}
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-slate-500">Items</dt>
            <dd className="text-sm font-bold text-slate-950">
              {sale.items.reduce((sum, item) => sum + item.quantity, 0)}
            </dd>
          </div>
        </dl>
        <button
          className="mt-6 min-h-12 w-full rounded-[0.65rem] border-0 bg-emerald-600 px-5 font-bold text-white"
          type="button"
          onClick={onNewSale}
        >
          Start new sale
        </button>
      </section>
    </div>
  );
}
