import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { listSellingBranchOptions } from '../api/sales-api';
import { sellingBranches } from '../model/sales.test-fixtures';
import { SalesBranchSelector } from './sales-branch-selector';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('../api/sales-api', () => ({ listSellingBranchOptions: vi.fn() }));

describe('SalesBranchSelector', () => {
  const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const branches = [
    ...sellingBranches,
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      name: 'Historical Cebu',
      code: 'CEB',
    },
  ];
  const remember = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      request: vi.fn(),
      user: { id: 'actor' },
    } as never);
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      setSelectedBranchId: remember,
    } as never);
    vi.mocked(listSellingBranchOptions).mockResolvedValue({
      items: branches.map(({ id, name, code }) => ({
        id,
        label: code ? `${name} (${code})` : name,
      })),
      hasNext: false,
    });
  });
  it('validates and remembers the current own-selling branch', async () => {
    render(
      <SalesBranchSelector
        organizationId={organizationId}
        branchId={branches[0].id}
        branchLabel={branches[0].name}
      />,
    );
    await waitFor(() => expect(remember).toHaveBeenCalledWith(branches[0].id));
    expect(
      screen.getByRole('combobox', { name: 'Sales branch' }),
    ).toHaveTextContent(branches[0].name);
  });
  it('navigates only to a returned own-selling branch', async () => {
    render(
      <SalesBranchSelector
        organizationId={organizationId}
        branchId={branches[0].id}
        branchLabel={branches[0].name}
      />,
    );
    const picker = await screen.findByRole('combobox', {
      name: 'Sales branch',
    });
    await waitFor(() => expect(picker).toBeEnabled());
    fireEvent.click(picker);
    fireEvent.click(screen.getByRole('option', { name: /Historical Cebu/ }));
    expect(remember).toHaveBeenLastCalledWith(branches[1].id);
    expect(push).toHaveBeenCalledWith(
      `/app/organizations/${organizationId}/branches/${branches[1].id}/sales`,
    );
  });
});
