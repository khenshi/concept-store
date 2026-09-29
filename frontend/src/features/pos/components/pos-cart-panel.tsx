'use client';

import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { TextField } from '@/shared/components/ui/text-field';
import { posCartTotal, posLineTotal, quantityError } from '../model/pos-cart';
import type { PosCartLine } from '../model/pos.types';

export function PosCartPanel({
  fullscreen = false,
  lines,
  locked,
  invalid,
  reviewDisabled,
  onClear,
  onRemove,
  onQuantityChange,
  onQuantityBlur,
  onAdjustQuantity,
  onReviewPayment,
  onClose,
  estimatedTotalLabel = 'Estimated total',
  reviewButtonLabel = 'Review payment',
}: {
  fullscreen?: boolean;
  lines: PosCartLine[];
  locked: boolean;
  invalid: boolean;
  reviewDisabled: boolean;
  onClear(): void;
  onRemove(line: PosCartLine): void;
  onQuantityChange(line: PosCartLine, value: string): void;
  onQuantityBlur(line: PosCartLine): void;
  onAdjustQuantity(line: PosCartLine, delta: -1 | 1): void;
  onReviewPayment(): void;
  onClose?(): void;
  estimatedTotalLabel?: string;
  reviewButtonLabel?: string;
}) {
  const itemCount = lines.reduce((total, line) => total + line.quantity, 0);
  const countLabel = `${itemCount} ${itemCount === 1 ? 'item' : 'items'} · ${lines.length} ${lines.length === 1 ? 'product' : 'products'}`;

  return (
    <section
      className={`flex h-full min-h-0 w-full flex-col overflow-hidden border border-hairline bg-surface lg:landscape:max-h-[calc(100dvh-18rem)] ${fullscreen ? 'lg:landscape:max-h-none' : ''}`}
      aria-label="Cart"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0">
          <h2
            tabIndex={onClose ? -1 : undefined}
            className="text-base font-semibold"
          >
            Cart
          </h2>
          <p className="text-xs text-muted">{countLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {lines.length ? (
            <Button
              variant="quiet"
              disabled={locked}
              onClick={onClear}
              className="px-3"
            >
              Clear cart
            </Button>
          ) : null}
          {onClose ? (
            <Button
              variant="quiet"
              aria-label="Close cart"
              title="Close cart"
              onClick={onClose}
              className="size-11 min-w-11 px-0 py-0"
            >
              <Icon name="close" className="size-4" />
            </Button>
          ) : null}
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        role="region"
        aria-label="Cart items"
      >
        {!lines.length ? (
          <p className="px-4 py-5 text-sm text-muted">Cart is empty.</p>
        ) : (
          <ul className="divide-y divide-hairline px-4">
            {lines.map((line) => {
              const available = line.product.quantity;
              const quantityIsValid = !quantityError(
                line.quantityInput,
                available,
              );
              return (
                <li
                  key={line.product.branchInventoryId}
                  className="min-w-0 py-3"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-semibold">
                        {line.product.name}
                      </h3>
                      <p className="mt-0.5 break-words text-xs text-muted">
                        {line.product.merchantName} · PHP{' '}
                        {line.product.sellingPrice} each · {available} available
                      </p>
                    </div>
                    <Button
                      variant="quiet"
                      aria-label={`Remove ${line.product.name}`}
                      title={`Remove ${line.product.name}`}
                      disabled={locked}
                      onClick={() => onRemove(line)}
                      className="size-11 min-w-11 shrink-0 px-0 py-0"
                    >
                      <Icon name="close" className="size-4" />
                    </Button>
                  </div>
                  <div className="mt-2 flex min-w-0 items-end justify-between gap-2">
                    <div className="flex min-w-0 items-end gap-1">
                      <Button
                        variant="secondary"
                        aria-label={`Decrease ${line.product.name} quantity`}
                        disabled={
                          locked || !quantityIsValid || line.quantity <= 1
                        }
                        onClick={() => onAdjustQuantity(line, -1)}
                        className="size-11 min-w-11 shrink-0 px-0 py-0"
                      >
                        <Icon name="minus" className="size-4" />
                      </Button>
                      <TextField
                        label={
                          <span className="sr-only">
                            Quantity for {line.product.name}
                          </span>
                        }
                        inputMode="numeric"
                        value={line.quantityInput}
                        error={line.error}
                        disabled={locked}
                        onChange={(event) =>
                          onQuantityChange(line, event.target.value)
                        }
                        onBlur={() => onQuantityBlur(line)}
                        containerClassName="w-[4.5rem] gap-1"
                        className="px-2 text-center tabular-nums"
                      />
                      <Button
                        variant="secondary"
                        aria-label={`Increase ${line.product.name} quantity`}
                        disabled={
                          locked ||
                          !quantityIsValid ||
                          line.quantity >= available
                        }
                        onClick={() => onAdjustQuantity(line, 1)}
                        className="size-11 min-w-11 shrink-0 px-0 py-0"
                      >
                        <Icon name="plus" className="size-4" />
                      </Button>
                    </div>
                    <p className="pb-2 text-right text-sm font-semibold tabular-nums">
                      PHP {posLineTotal(line)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="grid shrink-0 gap-2 border-t border-hairline bg-subtle px-4 py-3">
        {invalid ? (
          <p role="alert" className="text-xs text-danger">
            Fix the highlighted quantity before reviewing payment.
          </p>
        ) : null}
        <p className="flex items-center justify-between gap-3 font-semibold">
          <span>Estimated total</span>
          <output aria-label={estimatedTotalLabel} className="tabular-nums">
            PHP {posCartTotal(lines)}
          </output>
        </p>
        <Button
          aria-label={reviewButtonLabel}
          disabled={reviewDisabled}
          onClick={onReviewPayment}
        >
          Review payment
        </Button>
      </footer>
    </section>
  );
}
