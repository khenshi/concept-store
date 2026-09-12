import type { ReactNode } from 'react';

export function Notice({
  children,
  tone = 'success',
}: {
  children: ReactNode;
  tone?: 'success' | 'error';
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-compact border bg-surface p-3 text-sm leading-6 text-ink ${tone === 'error' ? 'border-danger' : 'border-success'}`}
    >
      {children}
    </p>
  );
}
