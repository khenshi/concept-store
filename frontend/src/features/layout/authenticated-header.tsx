'use client';

import Link from 'next/link';
import { LogoutButton } from '@/features/auth/logout-button';

export function AuthenticatedHeader() {
  return (
    <header className="flex items-center justify-between">
      <Link className="text-lg font-bold no-underline" href="/app">
        Concept Store
      </Link>
      <LogoutButton />
    </header>
  );
}
