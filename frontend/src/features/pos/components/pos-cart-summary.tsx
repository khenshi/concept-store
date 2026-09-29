'use client';

import { Button } from '@/shared/components/ui/button';
import { posCartTotal } from '../model/pos-cart';
import type { PosCartLine } from '../model/pos.types';

export function PosCartSummary({
  lines,
  reviewDisabled,
  onOpenCart,
  onReviewPayment,
}: {
  lines: PosCartLine[];
  reviewDisabled: boolean;
  onOpenCart(): void;
  onReviewPayment(): void;
}) {
  const itemCount = lines.reduce((total, line) => total + line.quantity, 0);
  return (
    <section
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:landscape:hidden"
      aria-label="Cart summary"
    >
      <div className="mx-auto grid w-full max-w-[90rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 pt-3 sm:px-6">
        <Button
          variant="secondary"
          onClick={onOpenCart}
          aria-label={`View cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
          className="min-w-0 justify-self-start px-3"
        >
          View cart <span aria-hidden="true">· {itemCount}</span>
        </Button>
        <p className="text-right text-sm font-semibold tabular-nums">
          <span className="mr-2 text-xs font-medium text-muted">Total</span>
          <output aria-label="Cart summary estimated total">
            PHP {posCartTotal(lines)}
          </output>
        </p>
        <Button
          aria-label="Review payment from cart summary"
          disabled={reviewDisabled}
          onClick={onReviewPayment}
          className="col-span-2 w-full"
        >
          Review payment
        </Button>
      </div>
    </section>
  );
}
