import { occupiedSpaceCount } from '@/features/spaces/api/space-api';
vi.mock('@/features/spaces/api/space-api', () => ({
  occupiedSpaceCount: vi.fn(),
}));
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { useConfirmationDialog } from '@/shared/components/ui/confirmation-dialog';
import { listBranches } from '@/features/branches/api/branch-api';
import { listAssociations, saveAssociation } from '../api/merchant-branch-api';
import { MerchantBranchManagement } from './merchant-branch-management';
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('@/shared/components/ui/confirmation-dialog', () => ({
  useConfirmationDialog: vi.fn(),
}));
vi.mock('@/features/branches/api/branch-api', () => ({
  listBranches: vi.fn(),
}));
vi.mock('../api/merchant-branch-api', () => ({
  listAssociations: vi.fn(),
  saveAssociation: vi.fn(),
}));
const org = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  merchant = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  branch = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const row = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  organizationId: org,
  merchantId: merchant,
  branchId: branch,
  status: 'INACTIVE' as const,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  merchant: {
    id: merchant,
    name: 'Merchant',
    code: null,
    status: 'ACTIVE' as const,
  },
  branch: { id: branch, name: 'Makati', code: 'MKT' },
};
const page = {
  items: [row],
  page: 1,
  limit: 15 as const,
  total: 1,
  totalPages: 1,
  hasNext: false,
};
describe('Merchant branch management', () => {
  const request = vi.fn(),
    confirm = vi.fn(),
    loadBranches = vi.fn();
  const setup = (role = 'OWNER') => {
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { id: org, role },
      loadBranches,
    } as never);
    return render(
      <MerchantBranchManagement
        organizationId={org}
        kind="merchant"
        id={merchant}
      />,
    );
  };
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(occupiedSpaceCount).mockResolvedValue(3);
    vi.mocked(useAuth).mockReturnValue({ request } as never);
    vi.mocked(useConfirmationDialog).mockReturnValue({
      confirm,
      confirmationDialog: null,
    });
    confirm.mockResolvedValue(true);
    loadBranches.mockResolvedValue([]);
    vi.mocked(listAssociations).mockResolvedValue(page);
    vi.mocked(saveAssociation).mockResolvedValue({ ...row, status: 'ACTIVE' });
  });
  it('shows owner actions, confirms reactivation and refreshes branch access', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Reactivate' }));
    await screen.findByText('Participation is now active.');
    expect(saveAssociation).toHaveBeenCalledWith(
      request,
      org,
      merchant,
      branch,
      'ACTIVE',
    );
    expect(confirm).toHaveBeenCalled();
    expect(loadBranches).toHaveBeenCalledWith({ refresh: true });
  });
  it('shows merchant read access without assignment/status controls', async () => {
    setup('MERCHANT');
    await screen.findByText('Makati');
    expect(
      screen.queryByRole('button', { name: 'Assign branch' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reactivate' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View inventory' }),
    ).toHaveAttribute(
      'href',
      `/app/organizations/${org}/branches/${branch}/inventory`,
    );
  });
  it('excludes existing inactive assignments and saves an explicit unassigned branch', async () => {
    const other = {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      name: 'BGC',
      code: null,
    };
    vi.mocked(listBranches).mockResolvedValue([row.branch, other]);
    setup();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Assign branch' }),
    );
    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(within(dialog).getByRole('combobox')).toBeEnabled(),
    );
    expect(
      within(dialog).queryByRole('option', { name: /Makati/ }),
    ).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole('combobox'), {
      target: { value: other.id },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Assign' }));
    await screen.findByText('Branch assignment saved.');
    expect(saveAssociation).toHaveBeenCalledWith(
      request,
      org,
      merchant,
      other.id,
      undefined,
    );
  });
  it('recovers failed association reads and rejects obsolete scope responses', async () => {
    vi.mocked(listAssociations).mockRejectedValueOnce(new Error('Read failed'));
    const view = setup();
    await screen.findByText('Read failed');
    fireEvent.click(screen.getByRole('button', { name: 'Retry associations' }));
    await screen.findByText('Makati');
    let resolve!: (value: typeof page) => void;
    vi.mocked(listAssociations).mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    view.rerender(
      <MerchantBranchManagement
        organizationId={org}
        kind="merchant"
        id={branch}
      />,
    );
    view.unmount();
    resolve(page);
    expect(saveAssociation).not.toHaveBeenCalled();
  });
  it('explains automatic branch-space release before deactivation', async () => {
    vi.mocked(listAssociations).mockResolvedValue({
      ...page,
      items: [{ ...row, status: 'ACTIVE' }],
    });
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(occupiedSpaceCount).toHaveBeenCalledWith(
      request,
      org,
      merchant,
      branch,
    );
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining(
          'All 3 occupied spaces in this branch will be released.',
        ),
      }),
    );
  });
});
