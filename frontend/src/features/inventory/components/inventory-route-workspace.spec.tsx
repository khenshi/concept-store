import { fireEvent, render, screen } from '@testing-library/react';
import { InventoryRouteWorkspace } from './inventory-route-workspace';
const route = vi.hoisted(() => ({
  pathname: '/app/organizations/org/branches/branch/inventory/stock',
  query: 'stockStatus=LOW_STOCK',
  push: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(route.query),
  useRouter: () => ({ push: route.push }),
}));
vi.mock('./inventory-directory', () => ({
  InventoryDirectory: ({
    selectedTab,
    initialStockStatus,
    onTabChange,
  }: {
    selectedTab: string;
    initialStockStatus?: string;
    onTabChange(tab: string): void;
  }) => (
    <>
      <p>{selectedTab}</p>
      <p>{initialStockStatus}</p>
      <button onClick={() => onTabChange('movements')}>Movements</button>
    </>
  ),
}));
describe('Inventory route workspace', () => {
  beforeEach(() => {
    route.push.mockClear();
    route.pathname = '/app/organizations/org/branches/branch/inventory/stock';
    route.query = 'stockStatus=LOW_STOCK';
  });
  it('navigates nested tabs without scrolling and retains the query', () => {
    render(<InventoryRouteWorkspace organizationId="org" branchId="branch" />);
    expect(screen.getByText('stock')).toBeInTheDocument();
    expect(screen.getByText('LOW_STOCK')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Movements' }));
    expect(route.push).toHaveBeenCalledWith(
      '/app/organizations/org/branches/branch/inventory/movements?stockStatus=LOW_STOCK',
      { scroll: false },
    );
  });
  it.each(['movements', 'integrity'])(
    'reads %s from direct navigation and history',
    (tab) => {
      route.pathname = `/app/organizations/org/branches/branch/inventory/${tab}`;
      render(
        <InventoryRouteWorkspace organizationId="org" branchId="branch" />,
      );
      expect(screen.getByText(tab)).toBeInTheDocument();
    },
  );
});
