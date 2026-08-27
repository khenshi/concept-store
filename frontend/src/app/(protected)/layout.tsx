import { AuthGate } from '@/features/auth/auth-gate';
import { AuthenticatedHeader } from '@/features/layout/authenticated-header';
import type { ReactNode } from 'react';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-slate-50">
        <a
          className="sr-only z-50 rounded-md bg-emerald-600 px-4 py-2 font-bold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          href="#main-content"
        >
          Skip to main content
        </a>
        <AuthenticatedHeader />
        <main className="w-full" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </AuthGate>
  );
}
