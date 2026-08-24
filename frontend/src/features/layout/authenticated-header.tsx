'use client';

import Link from 'next/link';
import { LogoutButton } from '@/features/auth/logout-button';

export function AuthenticatedHeader() {
  return (
    <header className="app-header">
      <Link className="wordmark" href="/app">
        Concept Store
      </Link>
      <LogoutButton />
    </header>
  );
}
