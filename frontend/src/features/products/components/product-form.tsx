'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import type { MerchantView } from '@/features/merchants/model/merchant.types';
import { buttonStyles } from '@/shared/components/ui/button';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { SelectControl } from '@/shared/components/ui/select-control';
import { createProduct, updateProduct } from '../api/product-api';
import {
  productCreateSchema,
  productProfileSchema,
} from '../model/product.schemas';
import type { Product } from '../model/product.types';

type Field = 'name' | 'sku' | 'barcode' | 'merchantId';
export function ProductForm({
  organizationId,
  merchants,
  product,
  onSaved,
  onCancel,
  onPendingChange,
}: {
  organizationId: string;
  merchants: MerchantView[];
  product?: Product;
  onSaved(product: Product): void;
  onCancel(): void;
  onPendingChange?(pending: boolean): void;
}) {
  const { request } = useAuth();
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const timers = useRef<Partial<Record<Field, number>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(
    () => () => {
      Object.values(timers.current).forEach(window.clearTimeout);
    },
    [],
  );
  function values(form: HTMLFormElement) {
    const data = new FormData(form);
    return Object.fromEntries(
      ['name', 'sku', 'barcode', 'merchantId'].map((name) => [
        name,
        data.get(name),
      ]),
    );
  }
  function validate(field: Field, immediate = false) {
    window.clearTimeout(timers.current[field]);
    const run = () => {
      if (!formRef.current) return;
      const result = (
        product ? productProfileSchema : productCreateSchema
      ).safeParse(values(formRef.current));
      const message = result.success
        ? undefined
        : result.error.issues.find((issue) => issue.path[0] === field)?.message;
      setErrors((current) => ({ ...current, [field]: message }));
    };
    if (immediate) run();
    else timers.current[field] = window.setTimeout(run, 300);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    Object.values(timers.current).forEach(window.clearTimeout);
    const input = values(event.currentTarget);
    const parsed = product
      ? productProfileSchema.safeParse(input)
      : productCreateSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path[0], issue.message]),
        ),
      );
      focusFirstInvalidField(event.currentTarget);
      return;
    }
    setErrors({});
    setError(null);
    setPending(true);
    onPendingChange?.(true);
    try {
      const saved = product
        ? await updateProduct(
            request,
            organizationId,
            product.id,
            productProfileSchema.parse(input),
          )
        : await createProduct(
            request,
            organizationId,
            productCreateSchema.parse(input),
          );
      onSaved(saved);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'The product could not be saved. Please try again.',
      );
    } finally {
      setPending(false);
      onPendingChange?.(false);
    }
  }
  const activeMerchants = merchants.filter(
    (merchant) => merchant.status === 'ACTIVE',
  );
  return (
    <form
      ref={formRef}
      className="mt-6 grid gap-5"
      noValidate
      onSubmit={submit}
      onChange={(event) => {
        if (event.target instanceof HTMLInputElement)
          validate(event.target.name as Field);
      }}
      onBlur={(event) => {
        if (event.target instanceof HTMLInputElement)
          validate(event.target.name as Field, true);
        else if (
          event.target instanceof HTMLButtonElement &&
          event.target.id === 'product-merchant'
        )
          validate('merchantId', true);
      }}
    >
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {!product ? (
        <div className="grid gap-2">
          <label
            htmlFor="product-merchant"
            className="text-label font-semibold"
          >
            Merchant
          </label>
          <SelectControl
            id="product-merchant"
            name="merchantId"
            required
            disabled={pending}
            aria-invalid={Boolean(errors.merchantId)}
            aria-describedby="product-merchant-hint"
            onValueChange={() => validate('merchantId')}
          >
            <option value="">Choose an active merchant</option>
            {activeMerchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </SelectControl>
          <p
            id="product-merchant-hint"
            className={`text-xs ${errors.merchantId ? 'text-danger' : 'text-muted'}`}
          >
            {errors.merchantId ??
              (activeMerchants.length
                ? 'Merchant ownership cannot be changed after creation.'
                : 'Add or activate a merchant before creating a product.')}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">
          Merchant ownership is fixed. Profile edits do not change branch prices
          or stock.
        </p>
      )}
      <TextField
        name="name"
        label="Product name"
        required
        maxLength={120}
        defaultValue={product?.name}
        error={errors.name}
        disabled={pending}
      />
      <div className="grid min-w-0 items-start gap-5 sm:grid-cols-2">
        <TextField
          name="sku"
          label="SKU (optional)"
          maxLength={32}
          defaultValue={product?.sku ?? ''}
          error={errors.sku}
          hint="Letters, numbers, and internal hyphens; saved in uppercase."
          disabled={pending}
          containerClassName="content-start"
        />
        <TextField
          name="barcode"
          label="Barcode (optional)"
          maxLength={64}
          defaultValue={product?.barcode ?? ''}
          error={errors.barcode}
          hint="Letters, numbers, and hyphens; case and leading zeroes are preserved."
          disabled={pending}
          containerClassName="content-start"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className={buttonStyles({ variant: 'primary' })}
          disabled={pending || (!product && !activeMerchants.length)}
          aria-busy={pending}
        >
          {pending ? 'Saving…' : product ? 'Save changes' : 'Create product'}
        </button>
        <button
          type="button"
          className={buttonStyles({ variant: 'secondary' })}
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
