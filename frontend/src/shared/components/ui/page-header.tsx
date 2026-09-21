import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
  id,
  className = '',
}: {
  title: string;
  description: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <header
      className={`flex items-start justify-between gap-6 border-b border-hairline pb-6 max-sm:flex-col ${className}`}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-3 break-words text-xs font-medium text-muted">
            {eyebrow}
          </p>
        ) : null}
        <h1 id={id} className="text-page break-words font-semibold text-ink">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0 max-sm:w-full">{action}</div> : null}
    </header>
  );
}
