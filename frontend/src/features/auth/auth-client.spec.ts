import { AuthClient, ApiError } from './auth-client';
import type { AuthResponse } from './auth.types';

const firstSession: AuthResponse = {
  accessToken: 'first-access-token',
  user: {
    id: 'user-id',
    email: 'owner@example.com',
    firstName: 'Maria',
    lastName: 'Santos',
    phone: null,
  },
};

const rotatedSession: AuthResponse = {
  ...firstSession,
  accessToken: 'rotated-access-token',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('AuthClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('logs in with credentials and keeps the access token in request memory', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(firstSession))
      .mockResolvedValueOnce(jsonResponse({ id: 'organization-id' }));
    const client = new AuthClient('http://localhost:3000');

    await client.login({
      email: 'owner@example.com',
      password: 'correct horse battery staple',
    });
    await client.request('/organizations');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
    const requestInit = fetchMock.mock.calls[1][1];
    expect(new Headers(requestInit?.headers).get('Authorization')).toBe(
      'Bearer first-access-token',
    );
  });

  it('updates the current profile through an authenticated request', async () => {
    const updatedUser = { ...firstSession.user, firstName: 'Mia' };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(firstSession))
      .mockResolvedValueOnce(jsonResponse(updatedUser));
    const client = new AuthClient('http://localhost:3000');
    await client.login({
      email: firstSession.user.email,
      password: 'password',
    });

    await expect(
      client.updateProfile({
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
      }),
    ).resolves.toEqual(updatedUser);

    const requestInit = fetchMock.mock.calls[1][1];
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:3000/auth/me');
    expect(requestInit).toEqual(
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
        }),
      }),
    );
    expect(new Headers(requestInit?.headers).get('Authorization')).toBe(
      `Bearer ${firstSession.accessToken}`,
    );
  });

  it('changes the password and clears the in-memory session', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(firstSession))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new AuthClient('http://localhost:3000');
    const listener = vi.fn();
    client.subscribe(listener);
    await client.login({
      email: firstSession.user.email,
      password: 'password',
    });

    await client.changePassword({
      currentPassword: 'current secure password',
      newPassword: 'different secure password',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/auth/change-password',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(listener).toHaveBeenLastCalledWith(null);
  });

  it('coordinates one refresh for concurrent unauthorized requests', async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;
    const authorizationHeaders: Array<string | null> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = input.toString();
        if (url.endsWith('/auth/login')) {
          return Promise.resolve(jsonResponse(firstSession));
        }
        if (url.endsWith('/auth/refresh')) {
          refreshCalls += 1;
          return Promise.resolve(jsonResponse(rotatedSession));
        }

        protectedCalls += 1;
        authorizationHeaders.push(
          new Headers(init?.headers).get('Authorization'),
        );
        return Promise.resolve(
          protectedCalls <= 2
            ? jsonResponse({ message: 'Unauthorized' }, 401)
            : jsonResponse({ ok: true }),
        );
      },
    );
    const client = new AuthClient('http://localhost:3000');
    await client.login({ email: 'owner@example.com', password: 'password' });

    await expect(
      Promise.all([client.request('/one'), client.request('/two')]),
    ).resolves.toEqual([{ ok: true }, { ok: true }]);

    expect(refreshCalls).toBe(1);
    expect(authorizationHeaders.slice(-2)).toEqual([
      'Bearer rotated-access-token',
      'Bearer rotated-access-token',
    ]);
  });

  it('restores an unauthenticated state when no refresh cookie is valid', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ message: 'Refresh session is invalid or expired' }, 401),
    );
    const client = new AuthClient('http://localhost:3000');
    const listener = vi.fn();
    client.subscribe(listener);

    await expect(client.restoreSession()).resolves.toBeNull();
    expect(listener).toHaveBeenCalledWith(null);
  });

  it('clears in-memory authentication even when logout cannot reach the API', async () => {
    const client = new AuthClient('http://localhost:3000');
    const listener = vi.fn();
    client.subscribe(listener);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(firstSession))
      .mockRejectedValueOnce(new Error('network unavailable'));
    await client.login({ email: 'owner@example.com', password: 'password' });

    await expect(client.logout()).rejects.toThrow('network unavailable');
    expect(listener).toHaveBeenLastCalledWith(null);
  });

  it('normalizes backend validation errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        { message: ['email must be an email', 'password is short'] },
        400,
      ),
    );
    const client = new AuthClient('http://localhost:3000');

    await expect(
      client.login({ email: 'invalid', password: 'short' }),
    ).rejects.toEqual(
      new ApiError(400, 'email must be an email, password is short'),
    );
  });
});
