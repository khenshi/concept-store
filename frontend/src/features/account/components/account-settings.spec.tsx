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
        colorTheme: 'GRAPHITE',
      },
      colorTheme: 'GRAPHITE',
      updateProfile,
      changePassword,
      deleteAccount,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('provides compact navigation for the account sections', () => {
    render(<AccountSettings />);
    const navigation = screen.getByRole('navigation', {
      name: 'Account settings sections',
    });
    expect(
      within(navigation).getByRole('link', { name: 'Profile' }),
    ).toHaveAttribute('href', '#profile');
    expect(
      within(navigation).getByRole('link', { name: 'Appearance' }),
    ).toHaveAttribute('href', '#appearance');
    expect(
      within(navigation).getByRole('link', { name: 'Security' }),
    ).toHaveAttribute('href', '#security');
    expect(
      within(navigation).getByRole('link', { name: 'Profile' }),
    ).toHaveAttribute('aria-current', 'location');
    expect(
      within(navigation).getByRole('link', { name: 'Appearance' }),
    ).not.toHaveAttribute('aria-current');
    expect(document.getElementById('profile')).toHaveClass('card-surface');
    expect(document.getElementById('appearance')).toHaveClass('card-surface');
    expect(document.getElementById('security')).toHaveClass('card-surface');
  });

  it('preserves profile values and saves normalized data with success feedback', async () => {
    render(<AccountSettings />);
    expect(screen.getByLabelText(/Email address/)).toHaveAttribute('readonly');
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

  it('rejects invalid Philippine phone numbers before submitting', async () => {
    render(<AccountSettings />);
    const form = screen.getByRole('form', { name: 'Personal information' });
    const phone = within(form).getByLabelText('Phone number');
    fireEvent.change(phone, { target: { value: '09AB 123 4567' } });
    expect(phone).toHaveValue('09 123 4567');
    fireEvent.change(phone, { target: { value: '091712345678999' } });
    expect(phone).toHaveValue('09171234567');
    fireEvent.change(phone, { target: { value: '1234567890' } });
    fireEvent.submit(form);
    expect(phone).toHaveAccessibleDescription(
      /Enter a valid Philippine phone number\./,
    );
    await waitFor(() => expect(phone).toHaveFocus());
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
    const currentPassword = within(form).getByLabelText('Current password');
    fireEvent.change(currentPassword, {
      target: { value: 'current-password' },
    });
    expect(currentPassword).toHaveAttribute('type', 'password');
    fireEvent.click(
      within(currentPassword.parentElement!).getByRole('button', {
        name: 'Show password',
      }),
    );
    expect(currentPassword).toHaveAttribute('type', 'text');
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
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Password changed. Signing you out on every device…',
    );
    expect(
      screen.getByRole('button', { name: 'Change password' }),
    ).not.toBeDisabled();
  });

  it('only shows password success after the change request resolves', async () => {
    let resolve!: () => void;
    changePassword.mockReturnValueOnce(
      new Promise<void>((complete) => {
        resolve = complete;
      }),
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
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Changing password…' }),
    ).toBeDisabled();
    await act(async () => resolve());
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Password changed. Signing you out on every device…',
    );
    expect(
      screen.getByRole('button', { name: 'Change password' }),
    ).not.toBeDisabled();
  });

  it('requires a password and explicit confirmation before deleting an account', async () => {
    render(<AccountSettings />);
    expect(
      screen.queryByRole('form', { name: 'Confirm account deletion' }),
    ).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Delete account' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('alertdialog', {
      name: 'Permanently delete your account?',
    });
    const form = within(dialog).getByRole('form', {
      name: 'Confirm account deletion',
    });
    const password = within(form).getByLabelText('Password');
    fireEvent.submit(form);
    await waitFor(() => expect(password).toHaveFocus());
    expect(deleteAccount).not.toHaveBeenCalled();
    fireEvent.change(password, { target: { value: 'current-password' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(deleteAccount).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    const confirmedDialog = screen.getByRole('alertdialog');
    const confirmedForm = within(confirmedDialog).getByRole('form', {
      name: 'Confirm account deletion',
    });
    fireEvent.change(within(confirmedForm).getByLabelText('Password'), {
      target: { value: 'current-password' },
    });
    fireEvent.click(
      within(confirmedForm).getByRole('button', { name: 'Delete account' }),
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
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    const dialog = screen.getByRole('alertdialog');
    const form = within(dialog).getByRole('form', {
      name: 'Confirm account deletion',
    });
    fireEvent.change(within(form).getByLabelText('Password'), {
      target: { value: 'current-password' },
    });
    fireEvent.click(
      within(form).getByRole('button', { name: 'Delete account' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A sole organization owner cannot delete their account.',
    );
    expect(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Delete account',
      }),
    ).not.toBeDisabled();
    expect(deleteAccount).toHaveBeenCalledOnce();
  });
});
