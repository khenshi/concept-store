import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { listBranches } from '@/features/branches/api/branch-api';
import { getOrganization } from '../api/organization-api';
import {
  OrganizationWorkspaceProvider,
  useOrganizationWorkspaceContext,
} from './organization-workspace-context';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/features/branches/api/branch-api', () => ({
  listBranches: vi.fn(),
}));
vi.mock('../api/organization-api', () => ({ getOrganization: vi.fn() }));

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
  status: 'ACTIVE' as const,
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
    upsertBranch,
    refreshOrganization,
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
      <button
        type="button"
        onClick={() => upsertBranch({ ...branch, name: 'Makati Flagship' })}
      >
        Update branch
      </button>
      <span>{branches[0]?.name}</span>
      <button onClick={() => void refreshOrganization()}>Refresh access</button>
    </>
  );
}

function PeriodConsumer() {
  const {
    organization: current,
    reportPeriod,
    setReportPeriod,
  } = useOrganizationWorkspaceContext();
  return (
    <>
      <span>{current?.name ?? 'Loading'}</span>
      <output aria-label="Remembered report period">
        {reportPeriod
          ? `${reportPeriod.preset}:${reportPeriod.dates.fromDay}`
          : 'Today default'}
      </output>
      <button
        onClick={() =>
          setReportPeriod({
            preset: 'LAST_2_YEARS',
            dates: { fromDay: '2024-09-15', throughDay: '2026-09-14' },
          })
        }
      >
        Apply remembered period
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

  it('keeps report periods above a remounted branch page and clears them for another tenant', async () => {
    const view = render(
      <OrganizationWorkspaceProvider organizationId="organization-id">
        <PeriodConsumer key="branch-one" />
      </OrganizationWorkspaceProvider>,
    );
    await screen.findByText('North & Pine');
    fireEvent.click(screen.getByText('Apply remembered period'));
    view.rerender(
      <OrganizationWorkspaceProvider organizationId="organization-id">
        <PeriodConsumer key="branch-two" />
      </OrganizationWorkspaceProvider>,
    );
    expect(screen.getByLabelText('Remembered report period')).toHaveTextContent(
      'LAST_2_YEARS:2024-09-15',
    );
    view.rerender(
      <OrganizationWorkspaceProvider organizationId="another-org">
        <PeriodConsumer key="branch-two" />
      </OrganizationWorkspaceProvider>,
    );
    expect(screen.getByLabelText('Remembered report period')).toHaveTextContent(
      'Today default',
    );
    await screen.findByText('North & Pine');
  });

  it('loads the organization and deduplicates cached branch requests', async () => {
    render(
      <OrganizationWorkspaceProvider organizationId="organization-id">
        <Consumer />
      </OrganizationWorkspaceProvider>,
    );
    expect(await screen.findByText('North & Pine')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load branches' }));
    expect(await screen.findByText('1 branches')).toBeInTheDocument();
    expect(listBranches).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Update branch' }));
    expect(screen.getByText('Makati Flagship')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load branches' }));
    await waitFor(() => expect(listBranches).toHaveBeenCalledTimes(1));
  });
  it('clears branch cache on access refresh and ignores an older branch response', async () => {
    let resolveOld!: (value: (typeof branch)[]) => void;
    vi.mocked(listBranches)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockResolvedValue([]);
    render(
      <OrganizationWorkspaceProvider organizationId="organization-id">
        <Consumer />
      </OrganizationWorkspaceProvider>,
    );
    await screen.findByText('North & Pine');
    fireEvent.click(screen.getByRole('button', { name: 'Load branches' }));
    await waitFor(() => expect(listBranches).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Refresh access' }));
    await screen.findByText('North & Pine');
    await act(async () => resolveOld([branch]));
    expect(screen.getByText('0 branches')).toBeInTheDocument();
    expect(screen.queryByText('Makati Main')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load branches' }));
    await waitFor(() => expect(listBranches).toHaveBeenCalledTimes(2));
  });
  it('does not reuse cached branch data when switching organization scope', async () => {
    const { rerender } = render(
      <OrganizationWorkspaceProvider organizationId="organization-id">
        <Consumer />
      </OrganizationWorkspaceProvider>,
    );
    await screen.findByText('North & Pine');
    fireEvent.click(screen.getByRole('button', { name: 'Load branches' }));
    await screen.findByText('Makati Main');
    vi.mocked(getOrganization).mockResolvedValue({
      ...organization,
      id: 'other-org',
      name: 'Other store',
      role: 'MANAGER',
    });
    vi.mocked(listBranches).mockResolvedValue([]);
    rerender(
      <OrganizationWorkspaceProvider organizationId="other-org">
        <Consumer />
      </OrganizationWorkspaceProvider>,
    );
    expect(screen.queryByText('Makati Main')).not.toBeInTheDocument();
    await screen.findByText('Other store');
    fireEvent.click(screen.getByRole('button', { name: 'Load branches' }));
    await waitFor(() =>
      expect(listBranches).toHaveBeenLastCalledWith(
        request,
        'other-org',
        'MANAGER',
      ),
    );
  });
});
