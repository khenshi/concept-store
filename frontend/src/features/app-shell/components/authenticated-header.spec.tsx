import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/model/auth-context';
import { AuthenticatedHeader } from './authenticated-header';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));

describe('AuthenticatedHeader', () => {
  it('keeps account access and logout available and announces pending logout', async () => {
    const replace = vi.fn();
    let finish!: () => void;
    const logout = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    vi.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<
      typeof useRouter
    >);
    vi.mocked(useAuth).mockReturnValue({
      user: { firstName: 'Ari', lastName: 'Mendoza', email: 'ari@example.com' },
      logout,
    } as unknown as ReturnType<typeof useAuth>);
    render(<AuthenticatedHeader />);
    expect(screen.getByRole('link', { name: 'Kapwesto home' })).toHaveAttribute(
      'href',
      '/app',
    );
    expect(
      screen.getByRole('link', { name: 'Open account settings' }),
    ).toHaveAttribute('href', '/app/account');
    await waitFor(() =>
      expect(screen.getByTitle('Philippine Standard Time')).toHaveAttribute(
        'datetime',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByRole('button', { name: 'Signing out…' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Signing out…' }),
    ).toHaveAttribute('aria-busy', 'true');
    await act(async () => finish());
    expect(logout).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith('/login');
  });
});
