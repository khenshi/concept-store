import { AuthGate } from '@/features/auth/auth-gate';
import { AuthenticatedHeader } from '@/features/layout/authenticated-header';
import type { ReactNode } from 'react';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-slate-50">
        <AuthenticatedHeader />
        <main className="w-full">{children}</main>
      </div>
    </AuthGate>
  );
}
