'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import type { Branch } from '@/features/branches/branch.types';
import type { Merchant } from '@/features/merchants/merchant.types';
import type { Product } from '@/features/products/product.types';
import { inventoryAdjustmentSchema, stockInSchema } from './inventory.schemas';
import type {
  InventoryAdjustmentInput,
  InventoryItem,
  StockInInput,
} from './inventory.types';

type Operation = { mode: 'stock-in' } | { mode: 'adjust'; item: InventoryItem };

export function InventoryOperationModal({
  operation,
  products,
  merchants,
  branches,
  isSaving,
  requestError,
  onClose,
  onStockIn,
  onAdjust,
}: {
  operation: Operation;
  products: Product[];
  merchants: Merchant[];
  branches: Branch[];
  isSaving: boolean;
  requestError: string | null;
  onClose(): void;
  onStockIn(input: StockInInput): Promise<void>;
  onAdjust(input: InventoryAdjustmentInput): Promise<void>;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [productId, setProductId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const selectedProduct = products.find((product) => product.id === productId);
  const selectedMerchant = merchants.find(
    (merchant) => merchant.id === selectedProduct?.merchantId,
  );
  const eligibleBranches = useMemo(() => {
    if (operation.mode === 'adjust') return [operation.item.branch];
    if (!selectedMerchant) return [];
    const ids = new Set(selectedMerchant.branches.map((branch) => branch.id));
    return branches.filter((branch) => ids.has(branch.id));
  }, [branches, operation, selectedMerchant]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const raw =
      operation.mode === 'adjust'
        ? {
            productId: operation.item.productId,
            branchId: operation.item.branchId,
            quantityChange: data.get('quantityChange'),
            note: data.get('note'),
            referenceId: data.get('referenceId'),
          }
        : {
            productId: data.get('productId'),
            branchId: data.get('branchId'),
            quantity: data.get('quantity'),
            note: data.get('note'),
            referenceId: data.get('referenceId'),
          };
    const parsed =
      operation.mode === 'adjust'
        ? inventoryAdjustmentSchema.safeParse(raw)
        : stockInSchema.safeParse(raw);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === 'string' && !next[field])
          next[field] = issue.message;
      });
      setErrors(next);
      return;
    }
    setErrors({});
    if (operation.mode === 'adjust')
      await onAdjust(parsed.data as InventoryAdjustmentInput);
    else await onStockIn(parsed.data as StockInInput);
  }

  const inputClass =
    'min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100';
  const adjusting = operation.mode === 'adjust';
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/35 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <section
        className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-operation-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
              Inventory operation
            </p>
            <h2
              className="mt-2 text-2xl font-bold tracking-[-0.03em]"
              id="inventory-operation-title"
              ref={headingRef}
              tabIndex={-1}
            >
              {adjusting ? 'Adjust inventory' : 'Record stock-in'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {adjusting
                ? `${operation.item.product.name} at ${operation.item.branch.name} currently has ${operation.item.quantity} on hand.`
                : 'Add stock only to a branch where the product merchant operates.'}
            </p>
          </div>
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
            type="button"
            disabled={isSaving}
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <form
          className="mt-6 grid gap-5"
          onSubmit={(event) => void submit(event)}
          noValidate
        >
          {!adjusting ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Product" id="productId" error={errors.productId}>
                <select
                  className={inputClass}
                  id="productId"
                  name="productId"
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                >
                  <option value="">Select a product</option>
                  {products
                    .filter((product) => product.status === 'ACTIVE')
                    .map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Branch" id="branchId" error={errors.branchId}>
                <select
                  className={inputClass}
                  id="branchId"
                  name="branchId"
                  defaultValue=""
                  disabled={!selectedProduct}
                >
                  <option value="">Select a branch</option>
                  {eligibleBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={adjusting ? 'Quantity change' : 'Quantity received'}
              id={adjusting ? 'quantityChange' : 'quantity'}
              error={errors[adjusting ? 'quantityChange' : 'quantity']}
            >
              <input
                className={inputClass}
                id={adjusting ? 'quantityChange' : 'quantity'}
                name={adjusting ? 'quantityChange' : 'quantity'}
                type="number"
                step="1"
                placeholder={adjusting ? '-2 or 3' : '12'}
              />
            </Field>
            <Field
              label="Reference (optional)"
              id="referenceId"
              error={errors.referenceId}
            >
              <input
                className={inputClass}
                id="referenceId"
                name="referenceId"
                maxLength={120}
                placeholder="Delivery or count reference"
              />
            </Field>
          </div>
          <Field
            label={adjusting ? 'Reason for adjustment' : 'Note (optional)'}
            id="note"
            error={errors.note}
          >
            <textarea
              className={`${inputClass} min-h-24 py-3`}
              id="note"
              name="note"
              maxLength={500}
              placeholder={
                adjusting
                  ? 'Explain the physical count or correction'
                  : 'Add receiving details'
              }
            />
          </Field>
          {requestError ? (
            <p
              className="rounded-lg border border-red-600 p-3 text-sm text-red-600"
              role="alert"
            >
              {requestError}
            </p>
          ) : null}
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              className="min-h-11 rounded-[0.6rem] border border-slate-200 bg-white px-4 font-bold"
              type="button"
              disabled={isSaving}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="min-h-11 rounded-[0.65rem] border-0 bg-emerald-600 px-5 font-bold text-white disabled:cursor-wait disabled:opacity-65"
              disabled={isSaving}
            >
              {isSaving
                ? 'Saving…'
                : adjusting
                  ? 'Apply adjustment'
                  : 'Record stock-in'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
