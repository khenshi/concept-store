import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { listMovementRecords } from '../api/inventory-api';
import { inventory, scope } from '../model/inventory.test-fixtures';
import { InventoryMovementRecords } from './inventory-movement-records';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../api/inventory-api', () => ({
  listMovementRecords: vi.fn(),
}));

const request = vi.fn();
const onAccessLost = vi.fn();
const branchScope = {
  organizationId: scope.organizationId,
  branchId: scope.branchId,
};
const record = {
  id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  branchId: scope.branchId,
  branchInventoryId: scope.inventoryId,
  type: 'RECEIPT' as const,
  quantityChange: 10,
  quantityAfter: 10,
  reason: 'Opening stock',
  createdAt: '2026-09-20T00:00:00.000Z',
  product: {
    id: inventory.product.id,
    name: inventory.product.name,
    sku: inventory.product.sku,
    barcode: inventory.product.barcode,
    merchant: {
      id: inventory.product.merchant.id,
      name: inventory.product.merchant.name,
      code: 'DEMO',
    },
  },
  actorName: 'Maria Santos',
};

describe('InventoryMovementRecords', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({ request } as never);
    vi.mocked(listMovementRecords).mockResolvedValue({
      items: [record],
      nextCursor: null,
    });
  });

  it('renders a table-shaped skeleton while records are loading', () => {
    vi.mocked(listMovementRecords).mockReturnValue(
      new Promise<never>(() => {}),
    );
    render(
      <InventoryMovementRecords
        {...scope}
        role="MANAGER"
        merchants={[]}
        onAccessLost={onAccessLost}
      />,
    );
    const skeleton = screen.getByRole('status', {
      name: 'Loading movement records',
    });
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(skeleton.querySelectorAll('.data-row')).toHaveLength(5);
  });

  it('loads branch records, renders actor and placement links, and debounces search', async () => {
    render(
      <InventoryMovementRecords
        {...scope}
        role="MANAGER"
        merchants={[]}
        onAccessLost={onAccessLost}
      />,
    );
    const viewReason = await screen.findByRole('button', { name: 'View' });
    expect(screen.getByText('9/20/2026')).toBeInTheDocument();
    expect(screen.getByText('8:00:00 AM (PH)')).toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: 'Branch movement records' }),
    ).toHaveClass('overflow-x-auto');
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    fireEvent.click(viewReason);
    expect(
      await screen.findByRole('dialog', { name: 'Movement reason' }),
    ).toHaveTextContent('Opening stock');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(
      screen.getByRole('link', { name: new RegExp(inventory.product.name) }),
    ).toHaveAttribute(
      'href',
      `/app/organizations/${scope.organizationId}/branches/${scope.branchId}/inventory/${scope.inventoryId}`,
    );
    const search = screen.getByRole('searchbox', {
      name: 'Search movement records',
    });
    fireEvent.change(search, { target: { value: 'opening' } });
    expect(listMovementRecords).toHaveBeenCalledOnce();
    await waitFor(() => expect(listMovementRecords).toHaveBeenCalledTimes(2));
    expect(listMovementRecords).toHaveBeenLastCalledWith(
      request,
      branchScope,
      'MANAGER',
      expect.objectContaining({ q: 'opening' }),
    );
  });

  it('applies Philippine date boundaries and pages ten-record results', async () => {
    const second = {
      ...record,
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      reason: 'Sale',
    };
    vi.mocked(listMovementRecords)
      .mockResolvedValueOnce({ items: [record], nextCursor: null })
      .mockResolvedValueOnce({ items: [record], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({ items: [second], nextCursor: null });
    render(
      <InventoryMovementRecords
        {...scope}
        role="OWNER"
        merchants={[]}
        onAccessLost={onAccessLost}
      />,
    );
    await screen.findByRole('button', { name: 'View' });
    fireEvent.change(screen.getByLabelText('From (PH)'), {
      target: { value: '2026-09-01' },
    });
    fireEvent.change(screen.getByLabelText('Through (PH)'), {
      target: { value: '2026-09-20' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
    await waitFor(() => expect(listMovementRecords).toHaveBeenCalledTimes(2));
    expect(listMovementRecords).toHaveBeenLastCalledWith(
      request,
      branchScope,
      'OWNER',
      expect.objectContaining({
        from: '2026-08-31T16:00:00.000Z',
        until: '2026-09-20T16:00:00.000Z',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(
      await screen.findByRole('dialog', { name: 'Movement reason' }),
    ).toHaveTextContent('Sale');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(listMovementRecords).toHaveBeenLastCalledWith(
      request,
      branchScope,
      'OWNER',
      expect.objectContaining({
        from: '2026-08-31T16:00:00.000Z',
        until: '2026-09-20T16:00:00.000Z',
      }),
      'cursor-1',
    );
  });

  it('hides merchant filters and actor names for merchant members', async () => {
    const { actorName, ...merchantRecord } = record;
    void actorName;
    vi.mocked(listMovementRecords).mockResolvedValue({
      items: [merchantRecord],
      nextCursor: null,
    });
    render(
      <InventoryMovementRecords
        {...scope}
        role="MERCHANT"
        merchants={[]}
        onAccessLost={onAccessLost}
      />,
    );
    await screen.findByRole('button', { name: 'View' });
    expect(screen.queryByText('Maria Santos')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Merchant' }),
    ).not.toBeInTheDocument();
    expect(listMovementRecords).toHaveBeenCalledWith(
      request,
      branchScope,
      'MERCHANT',
      expect.objectContaining({ merchantId: undefined }),
    );
  });
});
