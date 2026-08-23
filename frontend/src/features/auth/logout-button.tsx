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
      className="secondary-button"
      type="button"
      onClick={() => void handleLogout()}
      disabled={isPending}
    >
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
