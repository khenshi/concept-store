import { forwardRef, type ComponentProps } from 'react';
import { Icon, type IconName } from './icon';

export const InputControl = forwardRef<
  HTMLInputElement,
  ComponentProps<'input'> & { icon?: IconName }
>(function InputControl({ icon, className = '', ...props }, ref) {
  return (
    <span className="relative block min-w-0">
      <Icon
        name={icon ?? 'filter'}
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
      />
      <input
        {...props}
        ref={ref}
        className={`min-h-11 w-full min-w-0 rounded-full border border-control-border bg-surface px-3 py-2.5 !pl-10 text-body text-ink placeholder:text-faint focus-visible:border-focus disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-60 aria-invalid:border-danger ${className}`}
      />
    </span>
  );
});

InputControl.displayName = 'InputControl';
