import { render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { scope, completedSale } from '@/features/pos/model/pos.test-fixtures';
import { LegacySalesRoute } from './legacy-sales-route';
const { replace, router } = vi.hoisted(() => {
  const replace = vi.fn();
  return { replace, router: { replace } };
});
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('./branch-sales', () => ({
  BranchSales: () => <p>Merchant branch sales</p>,
}));
vi.mock('./sale-detail', () => ({
  SaleDetail: () => <p>Merchant own items</p>,
}));
describe('Compatible historical sales routes', () => {
  const workspace = (role: string) =>
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { id: scope.organizationId, role },
      organizationStatus: 'ready',
    } as never);
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'actor' } } as never);
    workspace('OWNER');
  });
  it.each(['OWNER', 'MANAGER', 'CASHIER'])(
    'redirects %s history into POS',
    async (role) => {
      workspace(role);
      render(<LegacySalesRoute {...scope} />);
      await waitFor(() =>
        expect(replace).toHaveBeenCalledWith(
          `/app/organizations/${scope.organizationId}/branches/${scope.branchId}/pos/sales`,
        ),
      );
      expect(
        screen.queryByText('Merchant branch sales'),
      ).not.toBeInTheDocument();
    },
  );
  it('preserves staff receipt deep links', async () => {
    render(<LegacySalesRoute {...scope} saleId={completedSale.id} />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        `/app/organizations/${scope.organizationId}/branches/${scope.branchId}/pos/sales/${completedSale.id}`,
      ),
    );
  });
  it('retains merchant own-sale history/detail without redirecting to POS', () => {
    workspace('MERCHANT');
    const view = render(<LegacySalesRoute {...scope} />);
    expect(screen.getByText('Merchant branch sales')).toBeInTheDocument();
    view.rerender(<LegacySalesRoute {...scope} saleId={completedSale.id} />);
    expect(screen.getByText('Merchant own items')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
