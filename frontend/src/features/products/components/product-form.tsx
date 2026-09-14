'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import type { MerchantView } from '@/features/merchants/model/merchant.types';
import { listBranches } from '@/features/branches/api/branch-api';
import type { BranchView } from '@/features/branches/model/branch.types';
import { buttonStyles } from '@/shared/components/ui/button';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { SelectControl } from '@/shared/components/ui/select-control';
import { createProduct, updateProduct } from '../api/product-api';
import {
  productCreateFieldsSchema,
  productProfileSchema,
} from '../model/product.schemas';
import type { Product, ProductInput } from '../model/product.types';

type Field =
  | 'name'
  | 'sku'
  | 'barcode'
  | 'merchantId'
  | 'branchId'
  | 'sellingPrice'
  | 'quantity';
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
  onSaved(product: Product, withOpeningStock?: boolean): void;
  onCancel(): void;
  onPendingChange?(pending: boolean): void;
}) {
  const { request } = useAuth();
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [openingEnabled, setOpeningEnabled] = useState(false);
  const [branches, setBranches] = useState<BranchView[]>([]);
  const [branchState, setBranchState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [branchRevision, setBranchRevision] = useState(0);
  const [recovery, setRecovery] = useState<ProductInput | null>(null);
  const submitted = useRef<ProductInput | null>(null);
  const saving = useRef(false);
  const disabled = pending || Boolean(recovery);
  const timers = useRef<Partial<Record<Field, number>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (product || !openingEnabled) return;
    let active = true;
    void listBranches(request, organizationId, 'OWNER')
      .then((items) => {
        if (active) {
          setBranches(items);
          setBranchState('ready');
        }
      })
      .catch(() => {
        if (active) {
          setBranches([]);
          setBranchState('error');
        }
      });
    return () => {
      active = false;
    };
  }, [request, organizationId, product, openingEnabled, branchRevision]);
  useEffect(() => {
    if (!disabled) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const blockNavigation = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('a[href]')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', blockNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', blockNavigation, true);
    };
  }, [disabled]);
  useEffect(
    () => () => {
      Object.values(timers.current).forEach(window.clearTimeout);
    },
    [],
  );
  function values(form: HTMLFormElement) {
    const data = new FormData(form);
    const identity = Object.fromEntries(
      ['name', 'sku', 'barcode', 'merchantId'].map((name) => [
        name,
        data.get(name),
      ]),
    );
    return !product && openingEnabled
      ? {
          ...identity,
          initialInventory: {
            branchId: data.get('branchId'),
            sellingPrice: data.get('sellingPrice'),
            quantity: data.get('quantity'),
          },
        }
      : identity;
  }
  function validate(field: Field, immediate = false) {
    if (disabled || !field) return;
    window.clearTimeout(timers.current[field]);
    const run = () => {
      if (
        !formRef.current ||
        saving.current ||
        submitted.current?.initialInventory
      )
        return;
      const result = (
        product ? productProfileSchema : productCreateFieldsSchema
      ).safeParse(values(formRef.current));
      const message = result.success
        ? undefined
        : result.error.issues.find((issue) => issue.path.at(-1) === field)
            ?.message;
      setErrors((current) => ({ ...current, [field]: message }));
    };
    if (immediate) run();
    else timers.current[field] = window.setTimeout(run, 300);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    Object.values(timers.current).forEach(window.clearTimeout);
    const input = recovery
      ? {
          ...recovery,
          sku: recovery.sku ?? '',
          barcode: recovery.barcode ?? '',
        }
      : values(event.currentTarget);
    const parsed = product
      ? productProfileSchema.safeParse(input)
      : productCreateFieldsSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path.at(-1),
            issue.message,
          ]),
        ),
      );
      focusFirstInvalidField(event.currentTarget);
      return;
    }
    if (
      !product &&
      openingEnabled &&
      !recovery &&
      (branchState !== 'ready' ||
        !branches.some(
          (branch) =>
            branch.id ===
            (parsed.data as ProductInput).initialInventory?.branchId,
        ))
    ) {
      setErrors((current) => ({
        ...current,
        branchId:
          'Load the available branches and choose a branch before saving.',
      }));
      focusFirstInvalidField(event.currentTarget);
      return;
    }
    const command = product
      ? null
      : (recovery ?? {
          ...productCreateFieldsSchema.parse(input),
          ...(!product && openingEnabled
            ? { requestId: crypto.randomUUID() }
            : {}),
        });
    submitted.current = command;
    setErrors({});
    setError(null);
    setPending(true);
    saving.current = true;
    onPendingChange?.(true);
    try {
      const saved = product
        ? await updateProduct(
            request,
            organizationId,
            product.id,
            productProfileSchema.parse(input),
          )
        : await createProduct(request, organizationId, command!);
      onSaved(saved, Boolean(command?.initialInventory));
      submitted.current = null;
      setRecovery(null);
    } catch (cause) {
      if (command?.initialInventory) setRecovery(command);
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'The product could not be saved. Please try again.',
      );
    } finally {
      setPending(false);
      saving.current = false;
      onPendingChange?.(Boolean(submitted.current?.initialInventory));
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
        else if (
          event.target instanceof HTMLButtonElement &&
          event.target.id === 'product-opening-branch'
        )
          validate('branchId', true);
      }}
    >
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {recovery ? (
        <p role="status" className="text-sm text-muted">
          The opening-stock outcome needs confirmation. Your submitted fields
          and request ID are locked. Retry the same creation to recover safely;
          keep this form open rather than creating another product.
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
            disabled={disabled}
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
        disabled={disabled}
      />
      <div className="grid min-w-0 items-start gap-5 sm:grid-cols-2">
        <TextField
          name="sku"
          label="SKU (optional)"
          maxLength={32}
          defaultValue={product?.sku ?? ''}
          error={errors.sku}
          hint="Letters, numbers, and internal hyphens; saved in uppercase."
          disabled={disabled}
          containerClassName="content-start"
        />
        <TextField
          name="barcode"
          label="Barcode (optional)"
          maxLength={64}
          defaultValue={product?.barcode ?? ''}
          error={errors.barcode}
          hint="Letters, numbers, and hyphens; case and leading zeroes are preserved."
          disabled={disabled}
          containerClassName="content-start"
        />
      </div>
      {!product ? (
        <section
          className="grid min-w-0 gap-5 rounded-control border border-hairline bg-subtle p-5"
          aria-label="Optional initial stock"
        >
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={openingEnabled}
              disabled={disabled}
              onChange={(event) => {
                setOpeningEnabled(event.target.checked);
                setBranches([]);
                setBranchState('loading');
                setErrors((current) => ({
                  ...current,
                  branchId: undefined,
                  sellingPrice: undefined,
                  quantity: undefined,
                }));
              }}
            />
            Add initial stock
          </label>
          <p className="text-sm text-muted">
            Optional. Choose one branch for its opening stock and PHP price.
            Other branches are unchanged. Leave this off to create only the
            product.
          </p>
          {openingEnabled ? (
            <>
              <div className="grid gap-2">
                <label
                  htmlFor="product-opening-branch"
                  className="text-label font-semibold"
                >
                  Initial stock branch
                </label>
                <SelectControl
                  id="product-opening-branch"
                  name="branchId"
                  required
                  disabled={disabled || branchState !== 'ready'}
                  aria-invalid={Boolean(errors.branchId)}
                  aria-describedby="product-opening-branch-hint"
                  onValueChange={() => validate('branchId')}
                >
                  <option value="">Choose a branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                      {branch.code ? ` · ${branch.code}` : ''}
                    </option>
                  ))}
                </SelectControl>
                <p
                  id="product-opening-branch-hint"
                  className={`text-xs ${errors.branchId || branchState === 'error' ? 'text-danger' : 'text-muted'}`}
                  role={branchState === 'error' ? 'alert' : undefined}
                >
                  {errors.branchId ??
                    (branchState === 'loading'
                      ? 'Loading available branches…'
                      : branchState === 'error'
                        ? 'Branches could not be loaded. Retry before adding initial stock.'
                        : !branches.length
                          ? 'Add a branch before adding initial stock.'
                          : 'Explicitly choose where this product will be stocked.')}
                </p>
                {branchState === 'error' ? (
                  <button
                    type="button"
                    className={buttonStyles({ variant: 'secondary' })}
                    disabled={disabled}
                    onClick={() => {
                      setBranchState('loading');
                      setBranchRevision((value) => value + 1);
                    }}
                  >
                    Retry branches
                  </button>
                ) : null}
              </div>
              <div className="grid min-w-0 items-start gap-5 sm:grid-cols-2">
                <TextField
                  name="sellingPrice"
                  label="Branch selling price (PHP)"
                  required
                  inputMode="decimal"
                  error={errors.sellingPrice}
                  disabled={disabled}
                  hint="Positive price, up to two decimal places."
                  containerClassName="content-start"
                />
                <TextField
                  name="quantity"
                  label="Initial stock quantity"
                  required
                  inputMode="numeric"
                  error={errors.quantity}
                  disabled={disabled}
                  hint="Whole units, from 1 to 2147483647."
                  containerClassName="content-start"
                />
              </div>
            </>
          ) : null}
        </section>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className={buttonStyles({ variant: 'primary' })}
          disabled={
            pending ||
            (!recovery &&
              !product &&
              (!activeMerchants.length ||
                (openingEnabled &&
                  (branchState !== 'ready' || !branches.length))))
          }
          aria-busy={pending}
        >
          {pending
            ? 'Saving…'
            : recovery
              ? 'Retry same creation'
              : product
                ? 'Save changes'
                : 'Create product'}
        </button>
        <button
          type="button"
          className={buttonStyles({ variant: 'secondary' })}
          disabled={disabled}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
