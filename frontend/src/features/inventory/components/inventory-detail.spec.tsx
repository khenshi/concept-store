import { fireEvent, render, screen } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import {
  getInventory,
  getInventoryBranch,
  listMovements,
  receiveStock,
} from '../api/inventory-api';
import {
  branch,
  inventory,
  movement,
  scope,
} from '../model/inventory.test-fixtures';
import { InventoryDetail } from './inventory-detail';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('../api/inventory-api', () => ({
  getInventory: vi.fn(),
  getInventoryBranch: vi.fn(),
  listMovements: vi.fn(),
  receiveStock: vi.fn(),
  adjustStock: vi.fn(),
  updateInventoryPrice: vi.fn(),
}));

describe('InventoryDetail workflows', () => {
  const request = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({ request } as never);
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { role: 'MANAGER' },
      organizationStatus: 'ready',
    } as never);
    vi.mocked(getInventory).mockResolvedValue(inventory);
    vi.mocked(getInventoryBranch).mockResolvedValue(branch);
    vi.mocked(listMovements).mockResolvedValue([movement]);
  });
  const submitReceipt = () => {
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Units to receive' }),
      { target: { value: '3' } },
    );
    const reasons = screen.getAllByRole('textbox', { name: 'Reason' });
    fireEvent.change(reasons[0], { target: { value: 'Delivery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Receive stock' }));
  };
  it('shows immutable ledger fields without actor personal data or mutation actions', async () => {
    render(<InventoryDetail {...scope} />);
    await screen.findByText('Opening delivery');
    expect(
      screen.getByLabelText('Inventory movement history'),
    ).toHaveTextContent(`Actor ID: ${movement.createdById}`);
    expect(
      screen.queryByRole('button', { name: /delete movement|edit movement/i }),
    ).not.toBeInTheDocument();
  });
  it('reloads actual stock rather than using a replayed historical balance', async () => {
    vi.mocked(receiveStock).mockResolvedValue({
      ...movement,
      quantityAfter: 3,
    });
    vi.mocked(getInventory)
      .mockResolvedValueOnce(inventory)
      .mockResolvedValue({ ...inventory, quantity: 17 });
    render(<InventoryDetail {...scope} />);
    await screen.findByText('Opening delivery');
    submitReceipt();
    expect(await screen.findByText('17 units')).toBeInTheDocument();
    expect(getInventory).toHaveBeenCalledTimes(2);
    expect(listMovements).toHaveBeenCalledTimes(2);
    expect(receiveStock).toHaveBeenCalledOnce();
  });
  it('hides stale write controls after refresh failure and retries reads only', async () => {
    vi.mocked(receiveStock).mockResolvedValue(movement);
    vi.mocked(getInventory)
      .mockResolvedValueOnce(inventory)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ ...inventory, quantity: 13 });
    render(<InventoryDetail {...scope} />);
    await screen.findByText('Opening delivery');
    submitReceipt();
    await screen.findByText(
      'Inventory and movement history could not be refreshed.',
    );
    expect(
      screen.queryByRole('button', { name: 'Receive stock' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('13 units');
    expect(receiveStock).toHaveBeenCalledOnce();
  });
  it('disables other write controls while a receipt is pending', async () => {
    vi.mocked(receiveStock).mockReturnValue(new Promise(() => {}));
    render(<InventoryDetail {...scope} />);
    await screen.findByText('Opening delivery');
    submitReceipt();
    expect(
      screen.getByRole('button', { name: 'Save branch price' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Review adjustment' }),
    ).toBeDisabled();
  });
  it.each(['CASHIER', 'MERCHANT'])(
    'does not request inventory for %s',
    (role) => {
      vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
        organization: { role },
        organizationStatus: 'ready',
      } as never);
      render(<InventoryDetail {...scope} />);
      expect(getInventory).not.toHaveBeenCalled();
      expect(listMovements).not.toHaveBeenCalled();
    },
  );
});
