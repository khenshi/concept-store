import { render, screen } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { listPosBranchOptions, listPosBranches } from '../api/pos-api';
import { PosEntry } from './pos-entry';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('../api/pos-api', () => ({
  listPosBranchOptions: vi.fn(),
  listPosBranches: vi.fn(),
}));
describe('POS organization entry', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      request: vi.fn(),
      user: { id: 'actor' },
    } as never);
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { id: 'org', role: 'OWNER' },
      organizationStatus: 'ready',
      branches: [{ id: 'branch', name: 'Main', code: 'MKT' }],
      branchesStatus: 'ready',
      branchesError: null,
      loadBranches: vi.fn(),
    } as never);
    vi.mocked(listPosBranches).mockResolvedValue([]);
    vi.mocked(listPosBranchOptions).mockResolvedValue({
      items: [],
      hasNext: false,
    });
  });
  it('offers authorized branch selection', async () => {
    render(<PosEntry organizationId="org" />);
    expect(screen.getByRole('heading', { name: 'POS' })).toBeInTheDocument();
    expect(screen.getByText('POS branch').parentElement).toHaveClass(
      'max-w-sm',
    );
    await screen.findByRole('status');
    expect(
      screen.getByRole('link', { name: /Main.*Open branch/ }),
    ).toHaveAttribute('href', '/app/organizations/org/branches/branch/pos');
    expect(listPosBranchOptions).toHaveBeenCalled();
  });
  it('keeps the header visible while access loads without reading branches', () => {
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: null,
      organizationStatus: 'loading',
    } as never);
    render(<PosEntry organizationId="org" />);
    expect(screen.getByRole('heading', { name: 'POS' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Choose an authorized branch to start a branch-specific cart.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading POS branch selector' }),
    ).toBeInTheDocument();
    expect(listPosBranches).not.toHaveBeenCalled();
  });
  it('does not load branches for merchant direct access', () => {
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { id: 'org', role: 'MERCHANT' },
    } as never);
    render(<PosEntry organizationId="org" />);
    expect(screen.getByRole('alert')).toHaveTextContent('cannot access POS');
    expect(listPosBranches).not.toHaveBeenCalled();
  });
});
