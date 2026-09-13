import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { listMerchants } from '@/features/merchants/api/merchant-api';
import { merchant } from '@/features/products/model/product.test-fixtures';
import { getInventoryBranch, listInventory } from '../api/inventory-api';
import { branch, inventory, scope } from '../model/inventory.test-fixtures';
import { InventoryDirectory } from './inventory-directory';
import { listBranches } from '@/features/branches/api/branch-api';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/branches/api/branch-api', () => ({
  listBranches: vi.fn(),
}));

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('@/features/merchants/api/merchant-api', () => ({
  listMerchants: vi.fn(),
}));
vi.mock('../api/inventory-api', () => ({
  getInventoryBranch: vi.fn(),
  listInventory: vi.fn(),
}));
vi.mock('./inventory-placement-form', () => ({
  InventoryPlacementForm: ({ onSaved }: { onSaved(): void }) => (
    <button onClick={onSaved}>Complete test placement</button>
  ),
}));

describe('InventoryDirectory workflows', () => {
  it('does not let an obsolete inventory read restore data after branch-list revocation', async () => {
    let finish!: (items: (typeof inventory)[]) => void;
    vi.mocked(listInventory).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    vi.mocked(listBranches).mockResolvedValue([]);
    render(<InventoryDirectory {...scope} />);
    await screen.findByRole('alert');
    await act(async () => finish([inventory]));
    expect(screen.queryByText('PHP 850.00')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Inventory access is unavailable',
    );
    expect(
      screen.queryByRole('link', { name: 'Back to branch' }),
    ).not.toBeInTheDocument();
  });
  const request = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listBranches).mockResolvedValue([
      { id: scope.branchId, name: branch.name, code: branch.code },
    ] as never);
    vi.mocked(useAuth).mockReturnValue({ request } as never);
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { role: 'OWNER' },
      organizationStatus: 'ready',
    } as never);
    vi.mocked(getInventoryBranch).mockResolvedValue(branch);
    vi.mocked(listInventory).mockResolvedValue([inventory]);
    vi.mocked(listMerchants).mockResolvedValue([merchant]);
  });
  it('displays branch price and stock with scoped placement navigation', async () => {
    render(<InventoryDirectory {...scope} />);
    expect(await screen.findByText('PHP 850.00')).toBeInTheDocument();
    expect(screen.getByText('10 units')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: `View ${inventory.product.name} inventory`,
      }),
    ).toHaveAttribute(
      'href',
      `/app/organizations/${scope.organizationId}/branches/${scope.branchId}/inventory/${scope.inventoryId}`,
    );
  });
  it('sends branch-scoped search and merchant/product lifecycle filters', async () => {
    render(<InventoryDirectory {...scope} />);
    await screen.findByText('PHP 850.00');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), {
      target: { value: '001Ab' },
    });
    await waitFor(() =>
      expect(listInventory).toHaveBeenLastCalledWith(
        request,
        { organizationId: scope.organizationId, branchId: scope.branchId },
        { q: '001Ab', merchantId: undefined, status: undefined },
      ),
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Merchant' }));
    fireEvent.click(screen.getByRole('option', { name: merchant.name }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Product status' }));
    fireEvent.click(screen.getByRole('option', { name: 'Inactive' }));
    await waitFor(() =>
      expect(listInventory).toHaveBeenLastCalledWith(
        request,
        { organizationId: scope.organizationId, branchId: scope.branchId },
        { q: '001Ab', merchantId: merchant.id, status: 'INACTIVE' },
      ),
    );
  });
  it('reloads inventory after the creation dialog completes', async () => {
    render(<InventoryDirectory {...scope} />);
    await screen.findByText('PHP 850.00');
    fireEvent.click(
      screen.getByRole('button', { name: 'Add product placement' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Add product placement' }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Complete test placement' }),
    );
    await waitFor(() => expect(listInventory).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('shows only own merchant placements with no placement creation', async () => {
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { role: 'MERCHANT' },
      organizationStatus: 'ready',
    } as never);
    render(<InventoryDirectory {...scope} />);
    await screen.findByRole('link', {
      name: `View ${inventory.product.name} inventory`,
    });
    expect(
      screen.queryByRole('button', { name: 'Add product placement' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/matching own placements/)).toBeInTheDocument();
  });
  it('explains an assigned merchant branch with no own inventory', async () => {
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { role: 'MERCHANT' },
      organizationStatus: 'ready',
    } as never);
    vi.mocked(listInventory).mockResolvedValue([]);
    render(<InventoryDirectory {...scope} />);
    expect(
      await screen.findByText(/never grants access to another merchant/),
    ).toBeInTheDocument();
  });
  it.each(['CASHIER'])('blocks data and controls for %s', (role) => {
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { role },
      organizationStatus: 'ready',
    } as never);
    render(<InventoryDirectory {...scope} />);
    expect(listInventory).not.toHaveBeenCalled();
    expect(getInventoryBranch).not.toHaveBeenCalled();
  });
  it('distinguishes empty and filtered-empty results', async () => {
    vi.mocked(listInventory).mockResolvedValue([]);
    render(<InventoryDirectory {...scope} />);
    await screen.findByText('No product placements yet');
    fireEvent.click(screen.getByRole('combobox', { name: 'Product status' }));
    fireEvent.click(screen.getByRole('option', { name: 'Inactive' }));
    expect(
      await screen.findByText('No placements match these filters'),
    ).toBeInTheDocument();
  });
});
