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
      className={`mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}
    >
      <header className="flex items-start justify-between gap-5 border-b border-slate-200 px-5 py-5 max-sm:grid sm:px-6">
        <div>
          <h2 className="text-base font-bold text-slate-950">{title}</h2>
          {description ? (
            <p className="mt-1.5 text-sm leading-6 text-slate-500">
              {description}
            </p>
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
      className={`border-b border-slate-200 bg-slate-50/60 px-5 py-5 sm:px-6 ${className}`}
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
      <label className="text-sm font-bold text-slate-700" htmlFor={id}>
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
      className={`mx-5 mt-5 rounded-lg border bg-white p-3 text-sm sm:mx-6 ${tone === 'success' ? 'border-green-600' : 'border-amber-500'}`}
      role={tone === 'success' ? 'status' : 'note'}
    >
      {children}
    </p>
  );
}
