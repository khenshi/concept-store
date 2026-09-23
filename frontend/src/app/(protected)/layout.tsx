import { AuthGate } from '@/features/auth/components/auth-gate';
import { ThemedWorkspace } from '@/features/app-shell/components/themed-workspace';
import type { ReactNode } from 'react';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <ThemedWorkspace>{children}</ThemedWorkspace>
    </AuthGate>
  );
}
