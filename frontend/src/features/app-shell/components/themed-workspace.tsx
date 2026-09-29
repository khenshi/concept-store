'use client';

import { useLayoutEffect, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { AuthenticatedHeader } from './authenticated-header';
import {
  useWorkspaceChrome,
  WorkspaceChromeProvider,
} from './workspace-chrome-context';

export function ThemedWorkspace({ children }: { children: ReactNode }) {
  const { colorTheme } = useAuth();

  useLayoutEffect(() => {
    document.documentElement.dataset.colorTheme = colorTheme;
    return () => {
      delete document.documentElement.dataset.colorTheme;
    };
  }, [colorTheme]);

  return (
    <WorkspaceChromeProvider>
      <ThemedWorkspaceContent>{children}</ThemedWorkspaceContent>
    </WorkspaceChromeProvider>
  );
}

function ThemedWorkspaceContent({ children }: { children: ReactNode }) {
  const { posFullscreen } = useWorkspaceChrome();
  return (
    <div
      className={`${posFullscreen ? 'h-dvh min-h-0 overflow-hidden' : 'min-h-screen'} bg-canvas text-ink print:bg-white`}
    >
      <a
        className="sr-only z-50 rounded-full bg-action px-4 py-2 font-semibold text-action-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        href="#main-content"
      >
        Skip to main content
      </a>
      {posFullscreen ? null : <AuthenticatedHeader />}
      <main
        className={posFullscreen ? 'h-full min-h-0 w-full' : 'w-full'}
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
