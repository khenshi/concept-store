import type { ComponentProps } from 'react';

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'quiet' | 'danger';

export function buttonStyles({
  variant = 'primary',
  className = '',
}: {
  variant?: ButtonVariant;
  className?: string;
} = {}) {
  return `ui-button ui-button-${variant} ${className}`;
}

export function Button({
  variant = 'primary',
  pending = false,
  pendingLabel,
  children,
  className = '',
  disabled,
  type = 'button',
  ...props
}: ComponentProps<'button'> & {
  variant?: ButtonVariant;
  pending?: boolean;
  pendingLabel?: string;
}) {
  return (
    <button
      {...props}
      type={type}
      className={buttonStyles({ variant, className })}
      disabled={disabled || pending}
      aria-busy={pending || props['aria-busy']}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
