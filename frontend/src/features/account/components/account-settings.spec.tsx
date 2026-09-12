import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { AccountSettings } from './account-settings';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
const updateProfile = vi.fn();
const changePassword = vi.fn();
const deleteAccount = vi.fn();

describe('AccountSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateProfile.mockResolvedValue(undefined);
    changePassword.mockResolvedValue(undefined);
    deleteAccount.mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      user: {
        firstName: 'Ari',
        lastName: 'Mendoza',
        email: 'ari@example.com',
        phone: '09171234567',
      },
      updateProfile,
      changePassword,
      deleteAccount,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('preserves profile values and saves normalized data with success feedback', async () => {
    render(<AccountSettings />);
    expect(screen.getByLabelText('Email address')).toHaveAttribute('readonly');
    const form = screen.getByRole('form', { name: 'Personal information' });
    fireEvent.change(within(form).getByLabelText('First name'), {
      target: { value: ' Arianna ' },
    });
    fireEvent.submit(form);
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({
        firstName: 'Arianna',
        lastName: 'Mendoza',
        phone: '09171234567',
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Your profile has been updated.',
    );
  });

  it('focuses invalid profile data and does not submit it', async () => {
    render(<AccountSettings />);
    const form = screen.getByRole('form', { name: 'Personal information' });
    const firstName = within(form).getByLabelText('First name');
    fireEvent.change(firstName, { target: { value: '' } });
    fireEvent.submit(form);
    expect(firstName).toHaveAccessibleDescription('Enter your first name.');
    await waitFor(() => expect(firstName).toHaveFocus());
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('blocks repeated saves while pending and recovers from server errors', async () => {
    let fail!: (error: Error) => void;
    updateProfile.mockReturnValueOnce(
      new Promise<void>((_, reject) => {
        fail = reject;
      }),
    );
    render(<AccountSettings />);
    const form = screen.getByRole('form', { name: 'Personal information' });
    fireEvent.submit(form);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    fireEvent.submit(form);
    expect(updateProfile).toHaveBeenCalledOnce();
    await act(async () => fail(new Error('Unavailable')));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your profile could not be updated.',
    );
    expect(
      screen.getByRole('button', { name: 'Save changes' }),
    ).not.toBeDisabled();
  });

  it('validates password confirmation and sends only the password contract', async () => {
    render(<AccountSettings />);
    const form = screen.getByRole('form', { name: 'Password' });
    fireEvent.change(within(form).getByLabelText('Current password'), {
      target: { value: 'current-password' },
    });
    fireEvent.change(within(form).getByLabelText('New password'), {
      target: { value: 'new-secure-password' },
    });
    const confirmation = within(form).getByLabelText('Confirm new password');
    fireEvent.change(confirmation, { target: { value: 'different-password' } });
    fireEvent.submit(form);
    expect(confirmation).toHaveAccessibleDescription('Passwords do not match.');
    await waitFor(() => expect(confirmation).toHaveFocus());
    expect(changePassword).not.toHaveBeenCalled();
    fireEvent.change(confirmation, {
      target: { value: 'new-secure-password' },
    });
    fireEvent.submit(form);
    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'current-password',
        newPassword: 'new-secure-password',
      }),
    );
    expect(
      screen.getByRole('button', { name: 'Changing password…' }),
    ).toBeDisabled();
  });

  it('requires a password and explicit confirmation before deleting an account', async () => {
    render(<AccountSettings />);
    const form = screen.getByRole('form', { name: 'Delete account' });
    const password = within(form).getByLabelText('Confirm your password');
    fireEvent.submit(form);
    await waitFor(() => expect(password).toHaveFocus());
    expect(deleteAccount).not.toHaveBeenCalled();
    fireEvent.change(password, { target: { value: 'current-password' } });
    const trigger = within(form).getByRole('button', {
      name: 'Delete account',
    });
    trigger.focus();
    fireEvent.submit(form);
    let dialog = screen.getByRole('alertdialog', {
      name: 'Permanently delete your account?',
    });
    expect(deleteAccount).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(deleteAccount).not.toHaveBeenCalled();
    fireEvent.submit(form);
    dialog = screen.getByRole('alertdialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Delete account' }),
    );
    await waitFor(() =>
      expect(deleteAccount).toHaveBeenCalledWith({
        password: 'current-password',
      }),
    );
  });

  it('shows password errors from the server and permits a retry', async () => {
    changePassword.mockRejectedValueOnce(
      new ApiError(401, 'Current password is incorrect.'),
    );
    render(<AccountSettings />);
    const form = screen.getByRole('form', { name: 'Password' });
    fireEvent.change(within(form).getByLabelText('Current password'), {
      target: { value: 'current-password' },
    });
    fireEvent.change(within(form).getByLabelText('New password'), {
      target: { value: 'new-secure-password' },
    });
    fireEvent.change(within(form).getByLabelText('Confirm new password'), {
      target: { value: 'new-secure-password' },
    });
    fireEvent.submit(form);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Current password is incorrect.',
    );
    expect(
      screen.getByRole('button', { name: 'Change password' }),
    ).not.toBeDisabled();
  });

  it('preserves sole-owner deletion rejection and returns to an actionable form', async () => {
    deleteAccount.mockRejectedValueOnce(
      new ApiError(
        409,
        'A sole organization owner cannot delete their account.',
      ),
    );
    render(<AccountSettings />);
    const form = screen.getByRole('form', { name: 'Delete account' });
    fireEvent.change(within(form).getByLabelText('Confirm your password'), {
      target: { value: 'current-password' },
    });
    fireEvent.submit(form);
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Delete account',
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A sole organization owner cannot delete their account.',
    );
    expect(
      within(form).getByRole('button', { name: 'Delete account' }),
    ).not.toBeDisabled();
    expect(deleteAccount).toHaveBeenCalledOnce();
  });
});
