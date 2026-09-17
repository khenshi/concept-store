import type { ReactNode } from 'react';

export function OperationalPage({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto mt-5 w-full max-w-7xl sm:mt-6">
      {children}
    </section>
  );
}

export function OperationalPanel({
  title,
  description,
  action,
  children,
  className = '',
  variant = 'card',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: 'card' | 'open';
}) {
  const open = variant === 'open';
  return (
    <section
      className={`${open ? 'mt-8 border-y border-hairline bg-surface' : 'mt-6 rounded-panel border border-hairline bg-surface'} text-ink ${className}`}
    >
      <header
        className={`flex items-start justify-between gap-5 border-b border-hairline py-5 max-sm:grid ${open ? '' : 'px-5 sm:px-6'}`}
      >
        <div className="min-w-0 break-words">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description ? (
            <p className="mt-1.5 text-sm leading-6 text-muted">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function OperationalToolbar({
  children,
  className = '',
  variant = 'card',
}: {
  children: ReactNode;
  className?: string;
  variant?: 'card' | 'open';
}) {
  return (
    <div
      className={`border-b border-hairline py-4 ${variant === 'open' ? 'bg-surface' : 'bg-subtle px-5 sm:px-6'} ${className}`}
    >
      {children}
    </div>
  );
}

export function FilterField({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <label className="text-label font-semibold text-ink" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function StatusNotice({
  children,
  tone = 'success',
}: {
  children: ReactNode;
  tone?: 'success' | 'warning';
}) {
  return (
    <p
      className={`mt-5 border-l-2 bg-subtle px-4 py-3 text-sm text-ink ${tone === 'success' ? 'border-success-ink' : 'border-warning'}`}
      role={tone === 'success' ? 'status' : 'note'}
    >
      {children}
    </p>
  );
}
