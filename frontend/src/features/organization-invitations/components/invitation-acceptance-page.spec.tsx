import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/model/auth-context';
import {
  acceptOrganizationInvitation,
  previewOrganizationInvitation,
} from '../api/organization-invitation-api';
import { InvitationAcceptancePage } from './invitation-acceptance-page';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../api/organization-invitation-api', () => ({
  acceptOrganizationInvitation: vi.fn(),
  previewOrganizationInvitation: vi.fn(),
}));
const push = vi.fn();
const request = vi.fn();
const logout = vi.fn();
const invitation = {
  organizationName: 'North & Pine',
  email: 'person@example.com',
  role: 'CASHIER' as const,
  expiresAt: '2026-09-19T00:00:00Z',
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({ push } as never);
  vi.mocked(useAuth).mockReturnValue({
    request,
    logout,
    status: 'unauthenticated',
    user: null,
  } as never);
  vi.mocked(previewOrganizationInvitation).mockResolvedValue(invitation);
});

it('offers sign-in and registration with the invitation return path', async () => {
  render(<InvitationAcceptancePage token="single-use-token" />);
  expect(
    await screen.findByRole('heading', { name: 'Join North & Pine' }),
  ).toBeVisible();
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    '/login?returnTo=%2Finvitations%2Fsingle-use-token',
  );
  expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute(
    'href',
    '/register?returnTo=%2Finvitations%2Fsingle-use-token',
  );
  expect(acceptOrganizationInvitation).not.toHaveBeenCalled();
});

it('does not accept for a mismatched account and offers sign-out', async () => {
  vi.mocked(useAuth).mockReturnValue({
    request,
    logout,
    status: 'authenticated',
    user: { email: 'other@example.com' },
  } as never);
  render(<InvitationAcceptancePage token="token" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
  expect(logout).toHaveBeenCalledOnce();
  expect(acceptOrganizationInvitation).not.toHaveBeenCalled();
});

it('automatically accepts once for the matching account', async () => {
  vi.mocked(useAuth).mockReturnValue({
    request,
    logout,
    status: 'authenticated',
    user: { email: invitation.email },
  } as never);
  vi.mocked(acceptOrganizationInvitation).mockResolvedValue({
    organizationId: 'org',
    organizationName: invitation.organizationName,
    role: 'CASHIER',
  });
  render(<InvitationAcceptancePage token="token" />);
  await waitFor(() =>
    expect(push).toHaveBeenCalledWith('/app/organizations/org'),
  );
  expect(acceptOrganizationInvitation).toHaveBeenCalledExactlyOnceWith(
    request,
    'token',
  );
});

it('shows an unavailable invitation with retry', async () => {
  vi.mocked(previewOrganizationInvitation).mockRejectedValue(
    new Error('offline'),
  );
  render(<InvitationAcceptancePage token="token" />);
  expect(await screen.findByText('Invitation unavailable')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  expect(acceptOrganizationInvitation).not.toHaveBeenCalled();
});
