'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from './auth-context';

export function LogoutButton() {
  const router = useRouter();
  const { logout } = useAuth();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);
    try {
      await logout();
    } finally {
      router.replace('/login');
    }
  }

  return (
    <button
      className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-wait disabled:opacity-65"
      type="button"
      onClick={() => void handleLogout()}
      disabled={isPending}
    >
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
