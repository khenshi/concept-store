'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BrandWordmark } from '@/shared/components/branding/brand-wordmark';
import { useAuth } from '@/features/auth/model/auth-context';
import { LogoutButton } from '@/features/auth/components/logout-button';
import { Icon } from '@/shared/components/ui/icon';

export function AuthenticatedHeader() {
  const { user } = useAuth();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const updateClock = () => setNow(new Date());
    const timeoutId = window.setTimeout(updateClock, 0);
    const intervalId = window.setInterval(updateClock, 30_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-surface text-ink print:hidden">
      <div className="flex h-17 w-full items-center justify-between gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-5">
          <BrandWordmark
            className="shrink-0 text-sm text-ink sm:text-base"
            href="/app"
            tone="neutral"
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-4">
          <time
            className="mr-auto hidden border-l border-hairline pl-6 text-xs font-medium text-muted lg:block"
            dateTime={now?.toISOString()}
            title="Philippine Standard Time"
          >
            {now
              ? new Intl.DateTimeFormat('en-PH', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Asia/Manila',
                }).format(now)
              : '\u00a0'}
          </time>
          {user ? (
            <Link
              className="flex min-h-11 min-w-11 max-w-64 items-center justify-center gap-3 rounded-control px-2 text-ink no-underline hover:bg-subtle"
              href="/app/account"
              aria-label="Open account settings"
            >
              <Icon name="account" className="size-4 text-muted" />
              <span className="hidden min-w-0 text-right md:grid">
                <strong className="truncate text-sm font-semibold text-ink">
                  {user.firstName} {user.lastName}
                </strong>
                <small className="truncate text-xs text-muted">
                  {user.email}
                </small>
              </span>
            </Link>
          ) : null}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
