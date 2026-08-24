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
      className="min-h-10 cursor-pointer rounded-[0.6rem] border border-slate-200 bg-white px-3.5 py-2.5 font-bold text-slate-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 disabled:cursor-wait disabled:opacity-65"
      type="button"
      onClick={() => void handleLogout()}
      disabled={isPending}
    >
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
