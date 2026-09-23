import { act, fireEvent, render, screen } from '@testing-library/react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { getInventoryReconciliation } from '../api/inventory-api';
import { inventory, scope } from '../model/inventory.test-fixtures';
import { InventoryReconciliation } from './inventory-reconciliation';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../api/inventory-api', () => ({
  getInventoryReconciliation: vi.fn(),
}));

const request = vi.fn();
const mismatch = {
  inventoryId: scope.inventoryId,
  productId: inventory.productId,
  productName: inventory.product.name,
  sku: inventory.product.sku,
  recordedQuantity: 10,
  ledgerQuantity: '9',
  difference: '1',
};

describe('InventoryReconciliation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({ request } as never);
  });

  it('uses a table-shaped skeleton while an integrity check is loading', () => {
    vi.mocked(getInventoryReconciliation).mockReturnValue(
      new Promise<never>(() => {}),
    );
    render(<InventoryReconciliation {...scope} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Check stock integrity' }),
    );
    const skeleton = screen.getByRole('status', {
      name: 'Checking stock movements',
    });
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(skeleton.querySelectorAll('.data-row')).toHaveLength(5);
  });

  it('waits for an explicit check and explains an empty result', async () => {
    vi.mocked(getInventoryReconciliation).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    render(<InventoryReconciliation {...scope} />);
    expect(getInventoryReconciliation).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Check stock integrity' }),
    );
    expect(
      await screen.findByText(/No stock\/ledger mismatch was found/),
    ).toBeInTheDocument();
    expect(getInventoryReconciliation).toHaveBeenCalledWith(
      request,
      {
        organizationId: scope.organizationId,
        branchId: scope.branchId,
      },
      undefined,
    );
  });

  it('links results and loads only the next bounded page', async () => {
    const second = {
      ...mismatch,
      inventoryId: '11111111-1111-4111-8111-111111111111',
      productName: 'Second',
    };
    vi.mocked(getInventoryReconciliation)
      .mockResolvedValueOnce({
        items: [mismatch],
        nextCursor: mismatch.inventoryId,
      })
      .mockResolvedValueOnce({ items: [second], nextCursor: null });
    render(<InventoryReconciliation {...scope} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Check stock integrity' }),
    );
    const link = await screen.findByRole('link', {
      name: mismatch.productName,
    });
    expect(link).toHaveAttribute(
      'href',
      `/app/organizations/${scope.organizationId}/branches/${scope.branchId}/inventory/${scope.inventoryId}`,
    );
    expect(
      screen.getByText(/Saved 10 · Ledger 9 · Difference 1/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Load more mismatches' }),
    );
    expect(
      await screen.findByRole('link', { name: 'Second' }),
    ).toBeInTheDocument();
    expect(getInventoryReconciliation).toHaveBeenLastCalledWith(
      request,
      {
        organizationId: scope.organizationId,
        branchId: scope.branchId,
      },
      mismatch.inventoryId,
    );
    expect(
      screen.queryByRole('button', { name: 'Load more mismatches' }),
    ).not.toBeInTheDocument();
  });

  it('clears unauthorized results and supports retry after a failed read', async () => {
    vi.mocked(getInventoryReconciliation)
      .mockResolvedValueOnce({ items: [mismatch], nextCursor: null })
      .mockRejectedValueOnce(new ApiError(403, 'Access revoked'))
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    render(<InventoryReconciliation {...scope} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Check stock integrity' }),
    );
    await screen.findByRole('link', { name: mismatch.productName });
    fireEvent.click(screen.getByRole('button', { name: 'Run check again' }));
    expect(await screen.findByText('Access revoked')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: mismatch.productName }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText(/No stock\/ledger mismatch was found/),
    ).toBeInTheDocument();
  });

  it('ignores a stale response after branch change', async () => {
    let finish!: (value: {
      items: (typeof mismatch)[];
      nextCursor: null;
    }) => void;
    vi.mocked(getInventoryReconciliation).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { rerender } = render(
      <InventoryReconciliation key={scope.branchId} {...scope} />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Check stock integrity' }),
    );
    const otherBranchId = '22222222-2222-4222-8222-222222222222';
    rerender(
      <InventoryReconciliation
        key={otherBranchId}
        organizationId={scope.organizationId}
        branchId={otherBranchId}
      />,
    );
    await act(async () => finish({ items: [mismatch], nextCursor: null }));
    expect(
      screen.queryByRole('link', { name: mismatch.productName }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Check stock integrity' }),
    ).toBeInTheDocument();
    expect(getInventoryReconciliation).toHaveBeenCalledTimes(1);
  });
});
