import { AuthGate } from '@/features/auth/components/auth-gate';
import { AuthenticatedHeader } from '@/features/app-shell/components/authenticated-header';
import type { ReactNode } from 'react';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-canvas text-ink print:bg-white">
        <a
          className="sr-only z-50 rounded-full bg-action px-4 py-2 font-semibold text-surface focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
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
