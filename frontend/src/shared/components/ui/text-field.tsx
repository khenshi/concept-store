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
  const describedBy =
    [
      props['aria-describedby'],
      hint ? `${fieldId}-hint` : undefined,
      error ? `${fieldId}-error` : undefined,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className={`grid min-w-0 gap-2 ${containerClassName}`}>
      <label className="text-label font-semibold text-ink" htmlFor={fieldId}>
        {label}
      </label>
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
      {hint && hintPosition === 'after' ? (
        <p className="text-xs leading-5 text-muted" id={`${fieldId}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-danger" id={`${fieldId}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function focusFirstInvalidField(form: HTMLFormElement) {
  window.requestAnimationFrame(() =>
    form.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus(),
  );
}
