'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authClient } from './auth-client';
import type { AuthenticatedUser, AuthStatus, Credentials } from './auth.types';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  error: string | null;
  login(credentials: Credentials): Promise<void>;
  register(credentials: Credentials): Promise<void>;
  logout(): Promise<void>;
  request<T>(path: string, init?: RequestInit): Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = authClient.subscribe((session) => {
      setUser(session?.user ?? null);
      setStatus(session ? 'authenticated' : 'unauthenticated');
      setError(null);
    });

    void authClient.restoreSession().catch((cause: unknown) => {
      setUser(null);
      setStatus('error');
      setError(
        cause instanceof Error ? cause.message : 'Session restore failed',
      );
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (credentials: Credentials) => {
    await authClient.login(credentials);
  }, []);

  const register = useCallback(async (credentials: Credentials) => {
    await authClient.register(credentials);
  }, []);

  const logout = useCallback(async () => {
    await authClient.logout();
  }, []);

  const request = useCallback(
    <T,>(path: string, init?: RequestInit) => authClient.request<T>(path, init),
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, error, login, register, logout, request }),
    [status, user, error, login, register, logout, request],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
