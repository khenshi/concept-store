'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SelectControl } from '@/components/ui/select-control';
import type { Branch } from '@/features/branches/branch.types';
import type { Merchant } from '@/features/merchants/merchant.types';
import { productSchema } from './product.schemas';
import type { Product, ProductInput } from './product.types';

type FieldName = keyof ProductInput;

export function ProductFormModal({
  merchants,
  branches,
  product,
  isSaving,
  requestError,
  onClose,
  onSave,
}: {
  merchants: Merchant[];
  branches: Branch[];
  product: Product | null;
  isSaving: boolean;
  requestError: string | null;
  onClose(): void;
  onSave(input: ProductInput): Promise<void>;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [merchantId, setMerchantId] = useState('');
  const [includeInitialStock, setIncludeInitialStock] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = productSchema.safeParse({
      merchantId: product?.merchantId ?? data.get('merchantId'),
      name: data.get('name'),
      sku: data.get('sku'),
      barcode: data.get('barcode'),
      sellingPrice: data.get('sellingPrice'),
      initialStock:
        !product && includeInitialStock
          ? {
              branchId: data.get('initialStock.branchId'),
              quantity: data.get('initialStock.quantity'),
              referenceId: data.get('initialStock.referenceId'),
              note: data.get('initialStock.note'),
            }
          : undefined,
    });
    if (!parsed.success) {
      const next: Partial<Record<FieldName, string>> = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as FieldName | undefined;
        if (field && !next[field]) next[field] = issue.message;
      });
      setErrors(next);
      const first = parsed.error.issues[0]?.path[0];
      if (typeof first === 'string') {
        const control = event.currentTarget.elements.namedItem(first);
        if (control instanceof HTMLElement) {
          control.focus();
          control.scrollIntoView({ block: 'center' });
        }
      }
      return;
    }
    setErrors({});
    await onSave(parsed.data);
  }

  const fieldClass =
    'min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100';

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
        aria-labelledby="product-form-title"
      >
        <div>
          <div>
            <p className="text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
              Product record
            </p>
            <h2
              className="mt-2 text-2xl font-bold tracking-[-0.03em]"
              id="product-form-title"
              ref={headingRef}
              tabIndex={-1}
            >
              {product ? 'Edit product' : 'Add product'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Codes identify the product; merchant ownership cannot be changed
              after creation.
            </p>
          </div>
        </div>
        <form
          className="mt-6 grid gap-5"
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
        >
          <Field label="Merchant" name="merchantId" error={errors.merchantId}>
            {product ? (
              <input
                className={`${fieldClass} bg-slate-50`}
                name="merchantId"
                value={product.merchant.name}
                disabled
              />
            ) : (
              <SelectControl
                className={fieldClass}
                id="merchantId"
                name="merchantId"
                defaultValue=""
                value={merchantId}
                onValueChange={setMerchantId}
                aria-invalid={Boolean(errors.merchantId)}
              >
                <option value="" disabled>
                  Select a merchant
                </option>
                {merchants.map((merchant) => (
                  <option value={merchant.id} key={merchant.id}>
                    {merchant.name}
                    {merchant.code ? ` (${merchant.code})` : ''}
                  </option>
                ))}
              </SelectControl>
            )}
          </Field>
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.45fr)]">
            <Field label="Product name" name="name" error={errors.name}>
              <input
                className={fieldClass}
                id="name"
                name="name"
                defaultValue={product?.name}
                maxLength={160}
                aria-invalid={Boolean(errors.name)}
              />
            </Field>
            <Field label="SKU" name="sku" error={errors.sku}>
              <input
                className={fieldClass}
                id="sku"
                name="sku"
                defaultValue={product?.sku}
                maxLength={32}
                autoCapitalize="characters"
                aria-invalid={Boolean(errors.sku)}
              />
            </Field>
          </div>
          {!product ? (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex cursor-pointer items-center gap-3 font-bold">
                <input
                  type="checkbox"
                  checked={includeInitialStock}
                  onChange={(event) =>
                    setIncludeInitialStock(event.target.checked)
                  }
                />
                Add initial stock
              </label>
              {includeInitialStock ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label
                      className="text-sm font-bold"
                      htmlFor="initial-stock-branch"
                    >
                      Branch
                    </label>
                    <SelectControl
                      className={fieldClass}
                      id="initial-stock-branch"
                      name="initialStock.branchId"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Select a branch
                      </option>
                      {branches
                        .filter((branch) =>
                          merchants
                            .find((merchant) => merchant.id === merchantId)
                            ?.branches.some((item) => item.id === branch.id),
                        )
                        .map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                    </SelectControl>
                  </div>
                  <div className="grid gap-2">
                    <label
                      className="text-sm font-bold"
                      htmlFor="initial-stock-quantity"
                    >
                      Quantity
                    </label>
                    <input
                      className={fieldClass}
                      id="initial-stock-quantity"
                      name="initialStock.quantity"
                      type="number"
                      min="1"
                      step="1"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label
                      className="text-sm font-bold"
                      htmlFor="initial-stock-reference"
                    >
                      Reference (optional)
                    </label>
                    <input
                      className={fieldClass}
                      id="initial-stock-reference"
                      name="initialStock.referenceId"
                      maxLength={120}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label
                      className="text-sm font-bold"
                      htmlFor="initial-stock-note"
                    >
                      Note (optional)
                    </label>
                    <input
                      className={fieldClass}
                      id="initial-stock-note"
                      name="initialStock.note"
                      maxLength={500}
                    />
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Barcode (optional)"
              name="barcode"
              error={errors.barcode}
            >
              <input
                className={fieldClass}
                id="barcode"
                name="barcode"
                defaultValue={product?.barcode ?? ''}
                maxLength={64}
                aria-invalid={Boolean(errors.barcode)}
              />
            </Field>
            <Field
              label="Selling price"
              name="sellingPrice"
              error={errors.sellingPrice}
            >
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-500">
                  ₱
                </span>
                <input
                  className={`${fieldClass} pl-8`}
                  id="sellingPrice"
                  name="sellingPrice"
                  inputMode="decimal"
                  defaultValue={product?.sellingPrice}
                  placeholder="0.00"
                  aria-invalid={Boolean(errors.sellingPrice)}
                />
              </div>
            </Field>
          </div>
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
              className="min-h-11 cursor-pointer rounded-[0.6rem] border border-slate-200 bg-white px-4 font-bold"
              type="button"
              disabled={isSaving}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="min-h-11 cursor-pointer rounded-[0.65rem] border-0 bg-emerald-600 px-5 font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-65"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : product ? 'Save changes' : 'Add product'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: FieldName;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold" htmlFor={name}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-red-600" id={`${name}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
