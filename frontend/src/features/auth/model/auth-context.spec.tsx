import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { AuthResponse } from './auth.types';

const authClientMock = vi.hoisted(() => ({
  listener: null as ((session: AuthResponse | null) => void) | null,
  subscribe: vi.fn(),
  restoreSession: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  request: vi.fn(),
  updateColorTheme: vi.fn(),
}));

vi.mock('../api/auth-client', () => ({ authClient: authClientMock }));

import { AuthProvider, useAuth } from './auth-context';

function StatusProbe() {
  const { status } = useAuth();
  return <span>{status}</span>;
}

function ThemeProbe() {
  const { colorTheme, updateColorTheme } = useAuth();
  return (
    <div>
      <span data-testid="theme">{colorTheme}</span>
      <button
        onClick={() => void updateColorTheme('OCEAN').catch(() => undefined)}
      >
        Choose Ocean
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authClientMock.subscribe.mockImplementation(
      (listener: (session: AuthResponse | null) => void) => {
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

  it('previews a theme immediately and restores the saved choice on failure', async () => {
    authClientMock.restoreSession.mockImplementation(async () => {
      authClientMock.listener?.({
        accessToken: 'token',
        user: {
          id: 'user-id',
          email: 'owner@example.com',
          firstName: 'Maria',
          lastName: 'Santos',
          phone: null,
          colorTheme: 'FOREST',
        },
      });
      return null;
    });
    let reject!: (error: Error) => void;
    authClientMock.updateColorTheme.mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    render(
      <AuthProvider>
        <ThemeProbe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('theme')).toHaveTextContent('FOREST'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Choose Ocean' }));
    expect(screen.getByTestId('theme')).toHaveTextContent('OCEAN');
    reject(new Error('Unavailable'));
    await waitFor(() =>
      expect(screen.getByTestId('theme')).toHaveTextContent('FOREST'),
    );
  });
});
