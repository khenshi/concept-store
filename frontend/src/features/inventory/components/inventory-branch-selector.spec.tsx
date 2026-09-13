import { fireEvent, render, screen } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { listBranches } from '@/features/branches/api/branch-api';
import { InventoryBranchSelector } from './inventory-branch-selector';
const { push, router } = vi.hoisted(() => {
  const push = vi.fn();
  return { push, router: { push } };
});
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/features/branches/api/branch-api', () => ({
  listBranches: vi.fn(),
}));
describe('Inventory branch selection', () => {
  const request = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({ request } as never);
    vi.mocked(listBranches).mockResolvedValue([
      { id: 'branch', organizationId: 'org', name: 'Makati', code: 'MKT' },
    ] as never);
  });
  it.each(['OWNER', 'MANAGER', 'MERCHANT'] as const)(
    'uses authorized branch reads for %s and requires explicit selection',
    async (role) => {
      render(<InventoryBranchSelector organizationId="org" role={role} />);
      await screen.findByText('Choose a branch');
      expect(push).not.toHaveBeenCalled();
      expect(listBranches).toHaveBeenCalledWith(request, 'org', role);
      fireEvent.click(
        screen.getByRole('combobox', { name: 'Inventory branch' }),
      );
      fireEvent.click(screen.getByRole('option', { name: 'Makati (MKT)' }));
      expect(push).toHaveBeenCalledWith(
        '/app/organizations/org/branches/branch/inventory',
      );
    },
  );
  it('shows unassigned state and denies cashier reads', async () => {
    vi.mocked(listBranches).mockResolvedValue([]);
    const view = render(
      <InventoryBranchSelector organizationId="org" role="MANAGER" />,
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'No accessible branches',
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
    vi.mocked(listBranches).mockClear();
    view.rerender(
      <InventoryBranchSelector organizationId="org" role="CASHIER" />,
    );
    expect(listBranches).not.toHaveBeenCalled();
  });
  it('does not navigate when a form guard rejects switching or a write is pending', async () => {
    const beforeChange = vi.fn().mockReturnValue(false);
    const view = render(
      <InventoryBranchSelector
        organizationId="org"
        role="OWNER"
        beforeChange={beforeChange}
      />,
    );
    await screen.findByText('Choose a branch');
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Makati (MKT)' }));
    expect(beforeChange).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
    view.rerender(
      <InventoryBranchSelector organizationId="org" role="OWNER" disabled />,
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
  it('rejects foreign tenant rows and supports read retry', async () => {
    vi.mocked(listBranches).mockResolvedValueOnce([
      { id: 'branch', organizationId: 'foreign', name: 'Private', code: null },
    ] as never);
    render(<InventoryBranchSelector organizationId="org" role="OWNER" />);
    await screen.findByRole('alert');
    expect(screen.queryByText('Private')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Choose a branch');
    expect(push).not.toHaveBeenCalled();
  });
  it('ignores an obsolete response after unmounting', async () => {
    let finish!: (branches: Awaited<ReturnType<typeof listBranches>>) => void;
    vi.mocked(listBranches).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const denied = vi.fn();
    const view = render(
      <InventoryBranchSelector
        organizationId="org"
        branchId="branch"
        role="OWNER"
        onAccessDenied={denied}
      />,
    );
    view.unmount();
    finish([]);
    await Promise.resolve();
    expect(denied).not.toHaveBeenCalled();
  });
});
