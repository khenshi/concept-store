import { render, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-context';
import { GuestGate } from './auth-gate';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));
vi.mock('./auth-context', () => ({ useAuth: vi.fn() }));

describe('GuestGate', () => {
  const replace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ replace } as never);
    window.history.replaceState({}, '', '/register');
  });

  it('returns an authenticated user to a local invitation path', async () => {
    vi.mocked(useAuth).mockReturnValue({ status: 'authenticated' } as never);
    window.history.replaceState(
      {},
      '',
      '/register?returnTo=%2Finvitations%2Finvitation-token',
    );

    render(
      <GuestGate>
        <p>Registration</p>
      </GuestGate>,
    );

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/invitations/invitation-token'),
    );
  });

  it('rejects an external protocol-relative return path', async () => {
    vi.mocked(useAuth).mockReturnValue({ status: 'authenticated' } as never);
    window.history.replaceState({}, '', '/login?returnTo=%2F%2Fevil.example');

    render(
      <GuestGate>
        <p>Login</p>
      </GuestGate>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/app'));
  });
});
