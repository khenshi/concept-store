import { render, screen } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { listPosBranches } from '../api/pos-api';
import { PosEntry } from './pos-entry';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('../api/pos-api', () => ({ listPosBranches: vi.fn() }));
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
    } as never);
    vi.mocked(listPosBranches).mockResolvedValue([]);
  });
  it('offers authorized branch selection', async () => {
    render(<PosEntry organizationId="org" />);
    expect(screen.getByRole('heading', { name: 'POS' })).toBeInTheDocument();
    await screen.findByRole('status');
    expect(listPosBranches).toHaveBeenCalled();
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
