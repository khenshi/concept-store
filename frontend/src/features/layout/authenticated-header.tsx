'use client';

import Link from 'next/link';
import { BrandWordmark } from '@/components/brand-wordmark';
import { useAuth } from '@/features/auth/auth-context';
import { LogoutButton } from '@/features/auth/logout-button';

export function AuthenticatedHeader() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="flex min-h-17 w-full items-center justify-between gap-6 px-5 lg:px-0">
        <div className="flex min-w-0 items-center gap-5 lg:w-[15.5rem] lg:border-r lg:border-slate-200 lg:px-6">
          <BrandWordmark
            className="shrink-0 text-sm text-slate-950 sm:text-base"
            href="/app"
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3 px-0 sm:gap-4 lg:px-7">
          <Link
            className="mr-auto hidden text-sm font-semibold text-slate-500 no-underline hover:text-emerald-700 md:block"
            href="/app"
          >
            All organizations
          </Link>
          {user ? (
            <span className="hidden max-w-56 truncate text-sm text-slate-500 md:block">
              {user.email}
            </span>
          ) : null}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
