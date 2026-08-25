import { AuthGate } from '@/features/auth/auth-gate';
import { AuthenticatedHeader } from '@/features/layout/authenticated-header';
import type { ReactNode } from 'react';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-slate-50">
        <AuthenticatedHeader />
        <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>
    </AuthGate>
  );
}
