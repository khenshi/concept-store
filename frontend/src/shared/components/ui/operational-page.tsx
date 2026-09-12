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
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`mt-6 overflow-hidden rounded-panel border border-hairline bg-surface text-ink ${className}`}
    >
      <header className="flex items-start justify-between gap-5 border-b border-hairline px-5 py-5 max-sm:grid sm:px-6">
        <div>
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
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-b border-hairline bg-subtle px-5 py-4 sm:px-6 ${className}`}
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
    <div className="grid gap-2">
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
      className={`mx-5 mt-5 rounded-compact border bg-surface p-3 text-sm text-ink sm:mx-6 ${tone === 'success' ? 'border-success' : 'border-warning'}`}
      role={tone === 'success' ? 'status' : 'note'}
    >
      {children}
    </p>
  );
}
