import 'client-only';

import { publicEnvironment } from '@/config/public-environment';
import type { AuthResponse, Credentials } from './auth.types';

interface ApiErrorBody {
  message?: string | string[];
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type SessionListener = (session: AuthResponse | null) => void;

export class AuthClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<AuthResponse | null> | null = null;
  private readonly listeners = new Set<SessionListener>();

  constructor(private readonly apiUrl: string) {}

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  register(credentials: Credentials): Promise<AuthResponse> {
    return this.authenticate('/auth/register', credentials);
  }

  login(credentials: Credentials): Promise<AuthResponse> {
    return this.authenticate('/auth/login', credentials);
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${this.apiUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      this.setSession(null);
    }
  }

  restoreSession(): Promise<AuthResponse | null> {
    return this.refresh();
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response = await this.authorizedFetch(path, init);

    if (response.status === 401 && this.accessToken) {
      const refreshed = await this.refresh();
      if (refreshed) response = await this.authorizedFetch(path, init);
    }

    if (!response.ok) throw await this.createApiError(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async authenticate(
    path: string,
    credentials: Credentials,
  ): Promise<AuthResponse> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) throw await this.createApiError(response);
    const session = (await response.json()) as AuthResponse;
    this.setSession(session);
    return session;
  }

  private refresh(): Promise<AuthResponse | null> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async performRefresh(): Promise<AuthResponse | null> {
    const response = await fetch(`${this.apiUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (response.status === 401) {
      this.setSession(null);
      return null;
    }
    if (!response.ok) throw await this.createApiError(response);

    const session = (await response.json()) as AuthResponse;
    this.setSession(session);
    return session;
  }

  private authorizedFetch(path: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    return fetch(`${this.apiUrl}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
  }

  private setSession(session: AuthResponse | null): void {
    this.accessToken = session?.accessToken ?? null;
    for (const listener of this.listeners) listener(session);
  }

  private async createApiError(response: Response): Promise<ApiError> {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // A non-JSON upstream error still receives a predictable message.
    }

    const message = Array.isArray(body.message)
      ? body.message.join(', ')
      : (body.message ?? `Request failed with status ${response.status}`);
    return new ApiError(response.status, message);
  }
}

export const authClient = new AuthClient(
  publicEnvironment.NEXT_PUBLIC_API_URL.replace(/\/$/, ''),
);
