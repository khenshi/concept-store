import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/features/auth/auth-context';
import { listBranches } from '@/features/branches/branch-api';
import { getOrganization } from './organization-api';
import {
  OrganizationWorkspaceProvider,
  useOrganizationWorkspaceContext,
} from './organization-workspace-context';

vi.mock('@/features/auth/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/features/branches/branch-api', () => ({ listBranches: vi.fn() }));
vi.mock('./organization-api', () => ({ getOrganization: vi.fn() }));

const request = vi.fn();
const organization = {
  id: 'organization-id',
  name: 'North & Pine',
  role: 'OWNER' as const,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};
const branch = {
  id: 'branch-id',
  organizationId: 'organization-id',
  name: 'Makati Main',
  code: 'MKT-01',
  addressLine1: '123 Retail Street',
  addressLine2: null,
  city: 'Makati',
  province: 'Metro Manila',
  postalCode: '1200',
  countryCode: 'PH',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

function Consumer() {
  const {
    organization: current,
    branches,
    loadBranches,
  } = useOrganizationWorkspaceContext();
  return (
    <>
      <span>{current?.name ?? 'Loading'}</span>
      <span>{branches.length} branches</span>
      <button
        type="button"
        onClick={() => void Promise.all([loadBranches(), loadBranches()])}
      >
        Load branches
      </button>
    </>
  );
}

describe('OrganizationWorkspaceProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ request } as unknown as ReturnType<
      typeof useAuth
    >);
    vi.mocked(getOrganization).mockResolvedValue(organization);
    vi.mocked(listBranches).mockResolvedValue([branch]);
  });

  it('loads organization data once and caches deduplicated branch requests', async () => {
    render(
      <OrganizationWorkspaceProvider organizationId="organization-id">
        <Consumer />
      </OrganizationWorkspaceProvider>,
    );

    expect(await screen.findByText('North & Pine')).toBeInTheDocument();
    expect(getOrganization).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Load branches' }));
    expect(await screen.findByText('1 branches')).toBeInTheDocument();
    expect(listBranches).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Load branches' }));
    await waitFor(() => expect(listBranches).toHaveBeenCalledTimes(1));
  });
});
