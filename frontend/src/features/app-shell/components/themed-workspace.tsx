'use client';

import { useLayoutEffect, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { AuthenticatedHeader } from './authenticated-header';

export function ThemedWorkspace({ children }: { children: ReactNode }) {
  const { colorTheme } = useAuth();

  useLayoutEffect(() => {
    document.documentElement.dataset.colorTheme = colorTheme;
    return () => {
      delete document.documentElement.dataset.colorTheme;
    };
  }, [colorTheme]);

  return (
    <div className="min-h-screen bg-canvas text-ink print:bg-white">
      <a
        className="sr-only z-50 rounded-full bg-action px-4 py-2 font-semibold text-action-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        href="#main-content"
      >
        Skip to main content
      </a>
      <AuthenticatedHeader />
      <main className="w-full" id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
