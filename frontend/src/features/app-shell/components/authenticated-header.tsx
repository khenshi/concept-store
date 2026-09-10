'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BrandWordmark } from '@/shared/components/branding/brand-wordmark';
import { useAuth } from '@/features/auth/model/auth-context';
import { LogoutButton } from '@/features/auth/components/logout-button';

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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white print:hidden">
      <div className="flex min-h-17 w-full items-center justify-between gap-6 px-5 lg:px-0">
        <div className="flex min-w-0 items-center gap-5 lg:w-[15.5rem] lg:border-r lg:border-slate-200 lg:px-6">
          <BrandWordmark
            className="shrink-0 text-sm text-slate-950 sm:text-base"
            href="/app"
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3 px-0 sm:gap-4 lg:px-7">
          <time
            className="mr-auto hidden text-sm font-semibold text-slate-500 md:block"
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
              className="hidden max-w-64 text-right no-underline md:grid"
              href="/app/account"
              aria-label="Open account settings"
            >
              <strong className="truncate text-sm text-slate-800">
                {user.firstName} {user.lastName}
              </strong>
              <small className="truncate text-slate-500">{user.email}</small>
            </Link>
          ) : null}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
