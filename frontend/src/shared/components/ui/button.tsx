import { forwardRef, type ComponentProps } from 'react';

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

export const Button = forwardRef<
  HTMLButtonElement,
  ComponentProps<'button'> & {
    variant?: ButtonVariant;
    pending?: boolean;
    pendingLabel?: string;
  }
>(function Button(
  {
    variant = 'primary',
    pending = false,
    pendingLabel,
    children,
    className = '',
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={buttonStyles({ variant, className })}
      disabled={disabled || pending}
      aria-busy={pending || props['aria-busy']}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
});
