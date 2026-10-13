import type { ReactNode } from 'react';
import { Icon } from './icon';

export function Notice({
  children,
  tone = 'success',
  title,
  className = '',
}: {
  children: ReactNode;
  tone?: 'success' | 'error' | 'warning';
  title?: string;
  className?: string;
}) {
  const styles = {
    success: {
      icon: 'check' as const,
      iconClassName: 'bg-success/10 text-success-ink',
      surfaceClassName: 'border-success/25 bg-success/5',
      role: 'status' as const,
    },
    error: {
      icon: 'alert' as const,
      iconClassName: 'bg-danger/10 text-danger',
      surfaceClassName: 'border-danger/25 bg-danger/5',
      role: 'alert' as const,
    },
    warning: {
      icon: 'alert' as const,
      iconClassName: 'bg-warning/10 text-warning',
      surfaceClassName: 'border-warning/25 bg-warning/5',
      role: 'note' as const,
    },
  }[tone];

  return (
    <div
      role={styles.role}
      className={`flex min-w-0 items-center gap-3 rounded-control border px-4 py-2 text-sm leading-6 text-ink ${styles.surfaceClassName} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${styles.iconClassName}`}
      >
        <Icon name={styles.icon} className="size-4" />
      </span>
      <div className="min-w-0 break-words">
        {title ? <p className="font-semibold text-ink">{title}</p> : null}
        <div className={title ? 'mt-1 text-muted' : 'text-ink'}>{children}</div>
      </div>
    </div>
  );
}
