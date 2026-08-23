import { AuthGate } from '@/features/auth/auth-gate';
import type { ReactNode } from 'react';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
