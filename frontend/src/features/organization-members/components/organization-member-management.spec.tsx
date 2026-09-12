import { render, screen } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { listOrganizationMembers } from '../api/organization-member-api';
import { listOrganizationInvitations } from '@/features/organization-invitations/api/organization-invitation-api';
import { OrganizationMemberManagement } from './organization-member-management';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('../api/organization-member-api', () => ({
  listOrganizationMembers: vi.fn(),
  updateOrganizationMemberRole: vi.fn(),
  removeOrganizationMember: vi.fn(),
}));
vi.mock(
  '@/features/organization-invitations/api/organization-invitation-api',
  () => ({
    listOrganizationInvitations: vi.fn(),
    revokeOrganizationInvitation: vi.fn(),
  }),
);
const member = {
  id: 'person',
  firstName: 'Mara',
  lastName: 'Santos',
  email: 'mara@example.com',
  phone: null,
  role: 'MANAGER' as const,
  joinedAt: '2026-09-12T00:00:00Z',
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ request: vi.fn() } as never);
  vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
    organization: { id: 'org', name: 'Store', role: 'OWNER' },
    organizationStatus: 'ready',
  } as never);
  vi.mocked(listOrganizationMembers).mockResolvedValue([member]);
  vi.mocked(listOrganizationInvitations).mockResolvedValue([]);
});

it('renders responsive member rows with uniquely named owner actions', async () => {
  render(<OrganizationMemberManagement organizationId="org" />);
  expect(
    await screen.findByRole('list', { name: 'Organization members' }),
  ).toBeVisible();
  expect(
    screen.getByRole('combobox', { name: 'Role for mara@example.com' }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Remove mara@example.com' }),
  ).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('keeps managers read-only and does not request invitations', async () => {
  vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
    organization: { id: 'org', role: 'MANAGER' },
    organizationStatus: 'ready',
  } as never);
  render(<OrganizationMemberManagement organizationId="org" />);
  await screen.findByText('Mara Santos');
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Invite member' }),
  ).not.toBeInTheDocument();
  expect(listOrganizationInvitations).not.toHaveBeenCalled();
});
