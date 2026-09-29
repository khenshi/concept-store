'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

interface WorkspaceChromeValue {
  posFullscreen: boolean;
  enterPosFullscreen(): void;
  exitPosFullscreen(): void;
}

const WorkspaceChromeContext = createContext<WorkspaceChromeValue>({
  posFullscreen: false,
  enterPosFullscreen: () => undefined,
  exitPosFullscreen: () => undefined,
});

export function WorkspaceChromeProvider({ children }: { children: ReactNode }) {
  const [posFullscreen, setPosFullscreen] = useState(false);
  const enterPosFullscreen = useCallback(() => setPosFullscreen(true), []);
  const exitPosFullscreen = useCallback(() => setPosFullscreen(false), []);

  useEffect(() => {
    if (!posFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [posFullscreen]);

  return (
    <WorkspaceChromeContext.Provider
      value={{ posFullscreen, enterPosFullscreen, exitPosFullscreen }}
    >
      {children}
    </WorkspaceChromeContext.Provider>
  );
}

export function useWorkspaceChrome() {
  return useContext(WorkspaceChromeContext);
}
