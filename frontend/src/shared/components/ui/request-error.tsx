import { Icon } from './icon';
import { Button } from './button';

export function RequestError({
  title,
  message,
  onRetry,
  className = '',
}: {
  title?: string;
  message: string;
  onRetry(): void;
  className?: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-4 rounded-panel border border-danger/25 bg-danger/5 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:p-5 ${className}`}
      role="alert"
    >
      <div className="flex min-w-0 gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-danger/10 text-danger"
        >
          <Icon name="alert" className="size-4" />
        </span>
        <div className="min-w-0 break-words">
          <h3 className="m-0 text-base font-semibold text-ink">
            {title ?? 'Something went wrong'}
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted">{message}</p>
        </div>
      </div>
      <Button
        variant="secondary"
        className="w-full shrink-0 sm:w-auto"
        onClick={onRetry}
      >
        Try again
      </Button>
    </div>
  );
}
