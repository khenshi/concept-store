import { useId, type ComponentProps, type ReactNode } from 'react';

export function TextField({
  label,
  error,
  hint,
  hintPosition = 'after',
  containerClassName = '',
  className = '',
  id,
  ...props
}: ComponentProps<'input'> & {
  label: ReactNode;
  error?: string | null;
  hint?: string;
  hintPosition?: 'before' | 'after';
  containerClassName?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const compactError = error ? compactFieldError(error) : undefined;
  const fullErrorId = `${fieldId}-error-detail`;
  const describedBy =
    [
      props['aria-describedby'],
      hint ? `${fieldId}-hint` : undefined,
      error
        ? compactError === error
          ? `${fieldId}-error`
          : fullErrorId
        : undefined,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className={`grid min-w-0 gap-2 ${containerClassName}`}>
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label className="text-label font-semibold text-ink" htmlFor={fieldId}>
          {label}
        </label>
        {error ? (
          <span
            className="max-w-full text-right text-xs leading-4 font-medium text-danger sm:max-w-[65%]"
            id={compactError === error ? `${fieldId}-error` : undefined}
            aria-hidden={compactError !== error ? 'true' : undefined}
            title={error}
          >
            {compactError}
          </span>
        ) : null}
      </div>
      {hint && hintPosition === 'before' ? (
        <p className="text-xs leading-5 text-muted" id={`${fieldId}-hint`}>
          {hint}
        </p>
      ) : null}
      <input
        {...props}
        id={fieldId}
        aria-invalid={Boolean(error) || props['aria-invalid']}
        aria-describedby={describedBy}
        className={`min-h-11 w-full min-w-0 rounded-control border border-control-border bg-surface px-3 py-2.5 text-body text-ink placeholder:text-faint focus-visible:border-focus read-only:bg-subtle read-only:text-muted disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-60 aria-invalid:border-danger ${className}`}
      />
      {error && compactError !== error ? (
        <span id={fullErrorId} className="sr-only">
          {error}
        </span>
      ) : null}
      {hint && hintPosition === 'after' ? (
        <p className="text-xs leading-5 text-muted" id={`${fieldId}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function compactFieldError(message: string) {
  if (/positive PHP price/i.test(message))
    return 'Enter a valid PHP price (up to 2 decimals).';
  if (/positive whole number/i.test(message)) return 'Enter a whole number.';
  if (/must contain at least (\d+) characters?/i.test(message))
    return `Use at least ${message.match(/at least (\d+) characters?/i)?.[1]} characters.`;
  if (/must be at least (\d+) unit/i.test(message))
    return `Enter at least ${message.match(/at least (\d+) unit/i)?.[1]} unit.`;
  if (/cannot be negative/i.test(message)) return 'Use 0 or higher.';
  if (/valid email/i.test(message)) return 'Enter a valid email.';
  if (message.length > 72) return `${message.slice(0, 69).trimEnd()}…`;
  return message;
}

export function focusFirstInvalidField(form: HTMLFormElement) {
  window.requestAnimationFrame(() =>
    form.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus(),
  );
}
