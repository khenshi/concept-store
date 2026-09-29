'use client';

import type { FormEvent, RefObject } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { RequestError } from '@/shared/components/ui/request-error';
import { TextField } from '@/shared/components/ui/text-field';
import type { PosProduct } from '../model/pos.types';

export function PosProductBrowser({
  fullscreen,
  code,
  codeError,
  codeRef,
  lookupPending,
  hasMatches,
  clearing,
  onCodeChange,
  onCodeBlur,
  onLookup,
  search,
  onSearchChange,
  settled,
  catalogLoading,
  catalogError,
  onCatalogRetry,
  products,
  onAdd,
  notice,
}: {
  fullscreen: boolean;
  code: string;
  codeError?: string;
  codeRef: RefObject<HTMLInputElement | null>;
  lookupPending: boolean;
  hasMatches: boolean;
  clearing: boolean;
  onCodeChange(value: string): void;
  onCodeBlur(): void;
  onLookup(): void;
  search: string;
  onSearchChange(value: string): void;
  settled: boolean;
  catalogLoading: boolean;
  catalogError: string | null;
  onCatalogRetry(): void;
  products: PosProduct[];
  onAdd(product: PosProduct): void;
  notice: string | null;
}) {
  const entryLocked = lookupPending || hasMatches || clearing;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onLookup();
  }

  return (
    <section
      className={`min-w-0 lg:landscape:flex lg:landscape:h-full lg:landscape:min-h-0 lg:landscape:flex-col lg:landscape:overflow-hidden ${fullscreen ? 'max-lg:flex max-lg:h-full max-lg:min-h-0 max-lg:flex-1 max-lg:flex-col max-lg:overflow-hidden' : ''}`}
    >
      <form
        noValidate
        className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 border-b border-hairline pb-3"
        onSubmit={submit}
      >
        <TextField
          ref={codeRef}
          label="SKU or barcode"
          value={code}
          autoComplete="off"
          spellCheck={false}
          placeholder="Scan or enter code"
          disabled={entryLocked}
          error={codeError}
          onChange={(event) => onCodeChange(event.target.value)}
          onBlur={onCodeBlur}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
            event.preventDefault();
            onLookup();
          }}
          containerClassName="min-w-0"
        />
        <Button
          type="submit"
          variant="accent"
          pending={lookupPending}
          pendingLabel="Looking up…"
          disabled={hasMatches || clearing}
          className="min-w-11 px-4"
        >
          Add code
        </Button>
      </form>

      <div className="border-b border-hairline py-3">
        <TextField
          label="Search products"
          type="search"
          value={search}
          placeholder="Name, SKU or barcode"
          onChange={(event) => onSearchChange(event.target.value)}
          containerClassName="gap-1.5"
        />
      </div>

      {notice ? (
        <p role="status" aria-live="polite" className="py-2 text-sm text-muted">
          {notice}
        </p>
      ) : null}

      <div
        className={`min-w-0 lg:landscape:min-h-0 lg:landscape:flex-1 lg:landscape:overflow-y-auto lg:landscape:overscroll-contain ${fullscreen ? 'max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:pb-28' : ''}`}
      >
        <div className="flex min-h-10 items-center justify-between gap-3 border-b border-hairline py-2">
          <h2 className="text-sm font-semibold">Products</h2>
          {!catalogLoading && settled && !catalogError ? (
            <span className="text-xs text-muted">
              {products.length} {products.length === 1 ? 'match' : 'matches'}
            </span>
          ) : null}
        </div>
        {!settled || catalogLoading ? (
          <ListSkeleton
            className="py-3"
            label="Searching branch products"
            rows={3}
          />
        ) : catalogError ? (
          <RequestError
            className="py-4"
            message={catalogError}
            onRetry={onCatalogRetry}
          />
        ) : !products.length ? (
          <p className="py-5 text-sm text-muted">
            {search.trim()
              ? 'No matching products. Try another search or scan a code.'
              : 'No active products are placed in this branch.'}
          </p>
        ) : (
          <ul aria-label="Product results" className="divide-y divide-hairline">
            {products.map((product) => (
              <li
                key={product.branchInventoryId}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"
              >
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-semibold">
                    {product.name}
                  </h3>
                  <p className="mt-0.5 break-words text-xs text-muted">
                    {product.merchantName} · SKU {product.sku ?? 'not set'}
                  </p>
                  <p className="mt-1 text-sm tabular-nums">
                    PHP {product.sellingPrice}
                    <span className="ml-2 text-xs text-muted">
                      {product.eligible
                        ? `${product.quantity} available`
                        : 'Out of stock'}
                    </span>
                  </p>
                </div>
                <Button
                  variant="secondary"
                  aria-label={`Add ${product.name}`}
                  disabled={!product.eligible || entryLocked}
                  onClick={() => onAdd(product)}
                  className="min-w-11 px-4"
                >
                  <Icon name="plus" className="size-4" />
                  Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
