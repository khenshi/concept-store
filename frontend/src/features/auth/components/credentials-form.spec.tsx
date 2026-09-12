import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../model/auth-context';
import { ApiError } from '../api/auth-client';
import { CredentialsForm } from './credentials-form';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));
vi.mock('../model/auth-context', () => ({ useAuth: vi.fn() }));
const login = vi.fn();
const register = vi.fn();
const replace = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/login');
  vi.mocked(useAuth).mockReturnValue({ login, register } as never);
  vi.mocked(useRouter).mockReturnValue({ replace } as never);
});
afterEach(() => window.history.replaceState({}, '', '/'));

it('focuses invalid login fields without calling authentication', async () => {
  render(<CredentialsForm mode="login" />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByText('Enter a valid email address.')).toBeVisible();
  await waitFor(() =>
    expect(screen.getByLabelText('Email address')).toHaveFocus(),
  );
  expect(login).not.toHaveBeenCalled();
});

it('preserves a local invitation return path after login', async () => {
  login.mockResolvedValue(undefined);
  window.history.replaceState({}, '', '/login?returnTo=%2Finvitations%2Ftoken');
  render(<CredentialsForm mode="login" />);
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: ' person@example.com ' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() =>
    expect(replace).toHaveBeenCalledWith('/invitations/token'),
  );
  expect(login).toHaveBeenCalledWith({
    email: 'person@example.com',
    password: 'password',
  });
});

it('normalizes registration fields and reports server rejection', async () => {
  register.mockRejectedValue(new ApiError(409, 'Account cannot be created.'));
  render(<CredentialsForm mode="register" />);
  for (const [label, value] of [
    ['First name', ' Mara '],
    ['Last name', ' Santos '],
    ['Email address', 'mara@example.com'],
    ['Password', 'long-password-123'],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Account cannot be created.',
  );
  expect(register).toHaveBeenCalledWith({
    firstName: 'Mara',
    lastName: 'Santos',
    phone: undefined,
    email: 'mara@example.com',
    password: 'long-password-123',
  });
  expect(replace).not.toHaveBeenCalled();
});

it('announces pending submission and prevents repeat activation', () => {
  login.mockReturnValue(new Promise(() => {}));
  render(<CredentialsForm mode="login" />);
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'person@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  const pending = screen.getByRole('button', { name: 'Signing in…' });
  expect(pending).toBeDisabled();
  expect(pending).toHaveAttribute('aria-busy', 'true');
  fireEvent.click(pending);
  expect(login).toHaveBeenCalledOnce();
});
