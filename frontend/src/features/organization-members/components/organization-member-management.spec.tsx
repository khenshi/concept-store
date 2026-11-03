import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import {
  listMemberBranches,
  loadMemberAccessOptions,
  listOrganizationMembers,
} from '../api/organization-member-api';
import {
  listOrganizationInvitations,
  removeOrganizationInvitation,
} from '@/features/organization-invitations/api/organization-invitation-api';
import type { OrganizationInvitation } from '@/features/organization-invitations/model/organization-invitation.types';
import { OrganizationMemberManagement } from './organization-member-management';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('../api/organization-member-api', () => ({
  listMemberBranches: vi.fn(),
  loadMemberAccessOptions: vi.fn(),
  listOrganizationMembers: vi.fn(),
  updateOrganizationMemberRole: vi.fn(),
  removeOrganizationMember: vi.fn(),
}));
vi.mock(
  '@/features/organization-invitations/api/organization-invitation-api',
  () => ({
    listOrganizationInvitations: vi.fn(),
    removeOrganizationInvitation: vi.fn(),
  }),
);
const member = {
  id: 'person',
  firstName: 'Mara',
  lastName: 'Santos',
  email: 'mara@example.com',
  phone: null,
  role: 'MANAGER' as const,
  branchAccessCount: 0,
  joinedAt: '2026-09-12T00:00:00Z',
};
const invitation = {
  id: 'invitation',
  organizationId: 'org',
  email: 'new-member@example.com',
  role: 'MANAGER' as const,
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  acceptedAt: null,
  revokedAt: null,
  createdAt: '2026-09-12T00:00:00Z',
  merchantId: null,
  merchant: null,
  branches: [{ branch: { id: 'branch', name: 'Makati', code: 'MKT' } }],
  status: 'PENDING' as const,
};
const memberPage = {
  items: [member],
  page: 1,
  limit: 15 as const,
  total: 1,
  totalPages: 1,
  hasNext: false,
};
const invitationPage = (items: OrganizationInvitation[] = []) => ({
  items,
  page: 1,
  limit: 15 as const,
  total: items.length,
  totalPages: items.length ? 1 : 0,
  hasNext: false,
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ request: vi.fn() } as never);
  vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
    organization: { id: 'org', name: 'Store', role: 'OWNER' },
    organizationStatus: 'ready',
  } as never);
  vi.mocked(listOrganizationMembers).mockResolvedValue(memberPage);
  vi.mocked(loadMemberAccessOptions).mockResolvedValue({
    branches: [],
    merchants: [],
  });
  vi.mocked(listMemberBranches).mockResolvedValue([]);
  vi.mocked(listOrganizationInvitations).mockResolvedValue(invitationPage());
});

it('renders responsive member rows with readable roles and uniquely named owner actions', async () => {
  render(<OrganizationMemberManagement organizationId="org" />);
  expect(
    await screen.findByRole('list', { name: 'Organization members' }),
  ).toBeVisible();
  expect(screen.getByText('Mara')).toBeVisible();
  expect(screen.getByText('Santos')).toBeVisible();
  expect(screen.getByText('Manager')).toBeVisible();
  expect(screen.getByText('No phone added')).toBeVisible();
  expect(screen.getByText('No branches assigned')).toBeVisible();
  expect(
    screen.getByRole('combobox', { name: 'Invitation status' }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Edit mara@example.com' }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Remove mara@example.com' }),
  ).toHaveClass('text-danger');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('opens the edit dialog from the member row action', async () => {
  render(<OrganizationMemberManagement organizationId="org" />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Edit mara@example.com' }),
  );
  expect(
    await screen.findByRole('dialog', {
      name: 'Edit access for mara@example.com',
    }),
  ).toBeVisible();
  expect(
    screen.getByRole('combobox', { name: 'Organization role' }),
  ).toBeVisible();
});

it('renders invitation details in separate labeled columns', async () => {
  vi.mocked(listOrganizationInvitations).mockResolvedValue(
    invitationPage([invitation]),
  );
  render(<OrganizationMemberManagement organizationId="org" />);
  expect(await screen.findByText('new-member@example.com')).toBeVisible();
  expect(screen.getByText('Makati')).toBeVisible();
  expect(screen.getByText('Pending')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Remove' })).toBeVisible();
  expect(screen.getAllByText('Recipient')).toHaveLength(2);
  expect(screen.getAllByText('Access')).toHaveLength(4);
  expect(screen.getAllByText('Actions')).toHaveLength(4);
});

it('cancels and removes a pending invitation', async () => {
  vi.mocked(listOrganizationInvitations).mockResolvedValue(
    invitationPage([invitation]),
  );
  vi.mocked(removeOrganizationInvitation).mockResolvedValue();
  render(<OrganizationMemberManagement organizationId="org" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove invitation' }));
  await waitFor(() =>
    expect(removeOrganizationInvitation).toHaveBeenCalledWith(
      expect.anything(),
      'org',
      invitation.id,
    ),
  );
  expect(screen.queryByText(invitation.email)).not.toBeInTheDocument();
});

it('removes historical invitations from the current list', async () => {
  const historicalInvitation = {
    ...invitation,
    id: 'historical-invitation',
    email: 'historical@example.com',
    acceptedAt: '2026-09-14T00:00:00Z',
    status: 'ACCEPTED' as const,
  };
  vi.mocked(listOrganizationInvitations).mockResolvedValue(
    invitationPage([historicalInvitation]),
  );
  render(<OrganizationMemberManagement organizationId="org" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove invitation' }));
  await waitFor(() =>
    expect(
      screen.queryByText(historicalInvitation.email),
    ).not.toBeInTheDocument(),
  );
  expect(removeOrganizationInvitation).toHaveBeenCalledWith(
    expect.anything(),
    'org',
    historicalInvitation.id,
  );
});

it('permanently deletes expired invitations', async () => {
  const expiredInvitation = {
    ...invitation,
    id: 'expired-invitation',
    email: 'expired@example.com',
    expiresAt: '2026-08-26T00:00:00Z',
    status: 'EXPIRED' as const,
  };
  vi.mocked(listOrganizationInvitations).mockResolvedValue(
    invitationPage([expiredInvitation]),
  );
  vi.mocked(removeOrganizationInvitation).mockResolvedValue();
  render(<OrganizationMemberManagement organizationId="org" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove invitation' }));
  await waitFor(() =>
    expect(removeOrganizationInvitation).toHaveBeenCalledWith(
      expect.anything(),
      'org',
      expiredInvitation.id,
    ),
  );
  expect(screen.queryByText(expiredInvitation.email)).not.toBeInTheDocument();
});

it('denies managers without requesting members or invitations', async () => {
  vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
    organization: { id: 'org', role: 'MANAGER' },
    organizationStatus: 'ready',
  } as never);
  render(<OrganizationMemberManagement organizationId="org" />);
  await screen.findByText('Member access is limited');
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Invite member' }),
  ).not.toBeInTheDocument();
  expect(listOrganizationInvitations).not.toHaveBeenCalled();
  expect(listOrganizationMembers).not.toHaveBeenCalled();
});
