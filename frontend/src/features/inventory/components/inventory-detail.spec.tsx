import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
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
import { listBranches } from '@/features/branches/api/branch-api';
const { push, router } = vi.hoisted(() => {
  const push = vi.fn();
  return { push, router: { push } };
});
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/features/branches/api/branch-api', () => ({
  listBranches: vi.fn(),
}));

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
  it('retains edits when a branch switch is cancelled and navigates to the new directory on confirmation', async () => {
    vi.mocked(listBranches).mockResolvedValue([
      { id: scope.branchId, name: branch.name, code: branch.code },
      { id: 'other', name: 'BGC', code: 'BGC' },
    ] as never);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<InventoryDetail {...scope} />);
    await screen.findByText('Opening delivery');
    const quantity = screen.getByRole('textbox', { name: 'Units to receive' });
    fireEvent.change(quantity, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('combobox', { name: 'Inventory branch' }));
    fireEvent.click(screen.getByRole('option', { name: 'BGC (BGC)' }));
    expect(push).not.toHaveBeenCalled();
    expect(quantity).toHaveValue('3');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('combobox', { name: 'Inventory branch' }));
    fireEvent.click(screen.getByRole('option', { name: 'BGC (BGC)' }));
    expect(push).toHaveBeenCalledWith(
      `/app/organizations/${scope.organizationId}/branches/other/inventory`,
    );
    expect(
      screen.queryByRole('textbox', { name: 'Units to receive' }),
    ).not.toBeInTheDocument();
  });
  it('disables branch switching while a stock write is pending', async () => {
    vi.mocked(receiveStock).mockReturnValue(new Promise(() => {}));
    render(<InventoryDetail {...scope} />);
    await screen.findByText('Opening delivery');
    submitReceipt();
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Inventory branch' }),
      ).toBeDisabled(),
    );
    expect(push).not.toHaveBeenCalled();
  });
  const request = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listBranches).mockResolvedValue([
      { id: scope.branchId, name: branch.name, code: branch.code },
    ] as never);
    vi.mocked(useAuth).mockReturnValue({ request } as never);
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { role: 'MANAGER' },
      organizationStatus: 'ready',
    } as never);
    vi.mocked(getInventory).mockResolvedValue(inventory);
    vi.mocked(getInventoryBranch).mockResolvedValue(branch);
    vi.mocked(listMovements).mockResolvedValue({
      items: [movement],
      nextCursor: null,
    });
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
  it('labels positive return movements as returns, not adjustments', async () => {
    vi.mocked(listMovements).mockResolvedValue({
      items: [
        { ...movement, type: 'RETURN', reason: 'Returned goods restocked' },
      ],
      nextCursor: null,
    });
    render(<InventoryDetail {...scope} />);
    await screen.findByText('Returned goods restocked');
    expect(
      screen.getByLabelText('Inventory movement history'),
    ).toHaveTextContent('Return');
  });
  it('shows own merchant history without actors or any stock writes', async () => {
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { role: 'MERCHANT' },
      organizationStatus: 'ready',
    } as never);
    const { createdById: _actor, ...ownMovement } = movement;
    expect(_actor).toBe(movement.createdById);
    vi.mocked(listMovements).mockResolvedValue({
      items: [ownMovement],
      nextCursor: null,
    });
    render(<InventoryDetail {...scope} />);
    await screen.findByText('Opening delivery');
    expect(screen.queryByText(/Actor ID/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save branch price' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Receive stock' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Review adjustment' }),
    ).not.toBeInTheDocument();
    expect(listMovements).toHaveBeenCalledWith(request, scope, 'MERCHANT');
  });
  it('clears actionable owner data immediately on a role change', async () => {
    const { rerender } = render(<InventoryDetail {...scope} />);
    await screen.findByText('Opening delivery');
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { role: 'MERCHANT' },
      organizationStatus: 'ready',
    } as never);
    rerender(<InventoryDetail {...scope} />);
    expect(
      screen.queryByRole('button', { name: 'Receive stock' }),
    ).not.toBeInTheDocument();
    await screen.findByText('Opening delivery');
    expect(screen.queryByText(/Actor ID/)).not.toBeInTheDocument();
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
  it('hides placement data and write controls when a stock request loses access', async () => {
    vi.mocked(receiveStock).mockRejectedValue(new ApiError(404, 'Not found'));
    render(<InventoryDetail {...scope} />);
    await screen.findByText('Opening delivery');
    submitReceipt();
    await screen.findByText(/Access to this placement is unavailable/);
    expect(screen.queryByText('Opening delivery')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Receive stock' }),
    ).not.toBeInTheDocument();
    expect(receiveStock).toHaveBeenCalledOnce();
  });
  it('loads older history without losing current stock or previously loaded entries', async () => {
    const older = {
      ...movement,
      id: '11111111-1111-4111-8111-111111111111',
      reason: 'Earlier delivery',
    };
    vi.mocked(listMovements)
      .mockResolvedValueOnce({ items: [movement], nextCursor: movement.id })
      .mockResolvedValueOnce({ items: [older], nextCursor: null });
    render(<InventoryDetail {...scope} />);
    await screen.findByText('Opening delivery');
    fireEvent.click(
      screen.getByRole('button', { name: 'Load older movements' }),
    );
    expect(await screen.findByText('Earlier delivery')).toBeInTheDocument();
    expect(screen.getByText('Opening delivery')).toBeInTheDocument();
    expect(screen.getByText('10 units')).toBeInTheDocument();
    expect(listMovements).toHaveBeenLastCalledWith(
      request,
      scope,
      'MANAGER',
      movement.id,
    );
    expect(
      screen.queryByRole('button', { name: 'Load older movements' }),
    ).not.toBeInTheDocument();
  });
  it('retries a failed older page without losing current stock or repeating a write', async () => {
    const older = {
      ...movement,
      id: '11111111-1111-4111-8111-111111111111',
      reason: 'Earlier delivery',
    };
    vi.mocked(listMovements)
      .mockResolvedValueOnce({ items: [movement], nextCursor: movement.id })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ items: [older], nextCursor: null });
    render(<InventoryDetail {...scope} />);
    await screen.findByText('Opening delivery');
    fireEvent.click(
      screen.getByRole('button', { name: 'Load older movements' }),
    );
    await screen.findByText('Older movements could not be loaded.');
    expect(screen.getByText('10 units')).toBeInTheDocument();
    expect(screen.getByText('Opening delivery')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Earlier delivery')).toBeInTheDocument();
    expect(listMovements).toHaveBeenCalledTimes(3);
    expect(receiveStock).not.toHaveBeenCalled();
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
  it.each(['CASHIER'])('does not request inventory for %s', (role) => {
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { role },
      organizationStatus: 'ready',
    } as never);
    render(<InventoryDetail {...scope} />);
    expect(getInventory).not.toHaveBeenCalled();
    expect(listMovements).not.toHaveBeenCalled();
  });
});
