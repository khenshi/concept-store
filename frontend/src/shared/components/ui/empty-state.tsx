import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
  className = '',
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`flex min-h-32 flex-col items-center justify-center rounded-control border border-hairline bg-subtle px-6 py-8 text-center ${className}`}
    >
      <h3 className="font-semibold text-ink">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
