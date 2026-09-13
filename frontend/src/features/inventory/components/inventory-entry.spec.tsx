import { render, screen } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { listBranches } from '@/features/branches/api/branch-api';
import { InventoryEntry } from './inventory-entry';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('@/features/branches/api/branch-api', () => ({
  listBranches: vi.fn(),
}));
describe('Organization inventory entry', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      request: vi.fn(),
      user: { id: 'actor' },
    } as never);
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { id: 'org', role: 'OWNER' },
      organizationStatus: 'ready',
    } as never);
    vi.mocked(listBranches).mockResolvedValue([]);
  });
  it('offers explicit authorized selection', async () => {
    render(<InventoryEntry organizationId="org" />);
    expect(
      screen.getByRole('heading', { name: 'Inventory' }),
    ).toBeInTheDocument();
    await screen.findByRole('status');
  });
  it('does not request branches for cashiers or a mismatched tenant context', () => {
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { id: 'org', role: 'CASHIER' },
    } as never);
    const view = render(<InventoryEntry organizationId="org" />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'cannot view or manage inventory',
    );
    expect(listBranches).not.toHaveBeenCalled();
    view.rerender(<InventoryEntry organizationId="foreign" />);
    expect(screen.getByRole('status')).toHaveAccessibleName(
      'Loading inventory access',
    );
    expect(listBranches).not.toHaveBeenCalled();
  });
});
