import { buttonStyles } from './button';
import { Icon } from './icon';

export function PaginationControls({
  ariaLabel,
  currentPage,
  totalPages,
  hasNext = true,
  pending = false,
  summary,
  onPrevious,
  onNext,
  previousLabel = 'Previous',
  nextLabel = 'Next',
  className = '',
}: {
  ariaLabel: string;
  currentPage: number;
  totalPages: number;
  hasNext?: boolean;
  pending?: boolean;
  summary?: string;
  onPrevious(): void;
  onNext(): void;
  previousLabel?: string;
  nextLabel?: string;
  className?: string;
}) {
  const availablePages = Math.max(1, totalPages);
  const pageText = `${currentPage}/${availablePages}`;

  return (
    <nav
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-4 sm:px-6 ${className}`}
      aria-label={ariaLabel}
    >
      {summary ? (
        <p className="text-sm text-muted">
          {summary}
          <span className="sr-only">
            {' · '}Page {currentPage} of {availablePages}
          </span>
        </p>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={buttonStyles({
            variant: 'quiet',
            className: 'size-11 min-h-11 !border-0 !px-0',
          })}
          aria-label={previousLabel}
          title={previousLabel}
          disabled={pending || currentPage <= 1}
          onClick={onPrevious}
        >
          <Icon name="arrow" className="mx-auto size-4 -rotate-180" />
        </button>
        <span
          className="min-w-12 text-center text-sm font-semibold tabular-nums text-ink"
          aria-live="polite"
          aria-label={`Page ${pageText}`}
        >
          <span className="sr-only">Page {currentPage}</span>
          <span aria-hidden="true">{pageText}</span>
        </span>
        <button
          type="button"
          className={buttonStyles({
            variant: 'quiet',
            className: 'size-11 min-h-11 !border-0 !px-0',
          })}
          aria-label={nextLabel}
          title={nextLabel}
          disabled={pending || !hasNext}
          onClick={onNext}
        >
          <Icon name="arrow" className="mx-auto size-4" />
        </button>
      </div>
    </nav>
  );
}
