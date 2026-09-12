'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '../model/auth-context';
import { Button } from '@/shared/components/ui/button';

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
    <Button
      variant="quiet"
      className="shrink-0 px-2.5"
      onClick={() => void handleLogout()}
      pending={isPending}
      pendingLabel="Signing out…"
    >
      Sign out
    </Button>
  );
}
