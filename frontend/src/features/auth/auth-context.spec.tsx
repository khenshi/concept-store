import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const authClientMock = vi.hoisted(() => ({
  listener: null as ((session: null) => void) | null,
  subscribe: vi.fn(),
  restoreSession: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  request: vi.fn(),
}));

vi.mock('./auth-client', () => ({ authClient: authClientMock }));

import { AuthProvider, useAuth } from './auth-context';

function StatusProbe() {
  const { status } = useAuth();
  return <span>{status}</span>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authClientMock.subscribe.mockImplementation(
      (listener: (session: null) => void) => {
        authClientMock.listener = listener;
        return vi.fn();
      },
    );
    authClientMock.restoreSession.mockImplementation(async () => {
      authClientMock.listener?.(null);
      return null;
    });
  });

  it('restores the browser session on mount', async () => {
    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText('unauthenticated')).toBeInTheDocument(),
    );
    expect(authClientMock.restoreSession).toHaveBeenCalledOnce();
  });
});
