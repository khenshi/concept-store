import { GuestGate } from '@/features/auth/components/auth-gate';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <GuestGate>{children}</GuestGate>;
}
