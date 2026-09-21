import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { adjustStock, receiveStock } from '../api/inventory-api';
import type { BranchInventory } from '../model/inventory.types';
import { InventoryStockForm } from './inventory-stock-form';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../api/inventory-api', () => ({
  receiveStock: vi.fn(),
  adjustStock: vi.fn(),
}));
const scope = {
  organizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  branchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  inventoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
};
const inventory: BranchInventory = {
  id: scope.inventoryId,
  organizationId: scope.organizationId,
  branchId: scope.branchId,
  productId: scope.inventoryId,
  sellingPrice: '12.50',
  quantity: 5,
  lowStockThreshold: 5,
  stockStatus: 'LOW_STOCK',
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
  product: {
    id: scope.inventoryId,
    merchantId: scope.branchId,
    name: 'Vase',
    sku: 'VA',
    barcode: '001Ab',
    status: 'ACTIVE',
    merchant: { id: scope.branchId, name: 'Merchant', status: 'ACTIVE' },
  },
};
describe('InventoryStockForm', () => {
  const request = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ request } as never);
  });
  afterEach(() => vi.useRealTimers());
  const fill = (quantity: string, mode = 'receipt') => {
    if (mode === 'adjustment') {
      fireEvent.click(
        screen.getByRole('combobox', { name: 'Adjustment method' }),
      );
      fireEvent.click(screen.getByRole('option', { name: 'Quantity change' }));
    }
    fireEvent.change(
      screen.getByRole('textbox', {
        name: mode === 'receipt' ? 'Units to receive' : 'Quantity change',
      }),
      { target: { value: quantity } },
    );
    if (mode === 'adjustment')
      fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
        target: { value: ' Delivery ' },
      });
  };
  it('reuses request ID after an uncertain failure and changes it when edited', async () => {
    vi.mocked(receiveStock).mockRejectedValue(new Error('Connection lost'));
    render(
      <InventoryStockForm
        scope={scope}
        inventory={inventory}
        mode="receipt"
        onSaved={vi.fn()}
        onPendingChange={vi.fn()}
      />,
    );
    fill('3');
    fireEvent.click(screen.getByRole('button', { name: 'Receive stock' }));
    await screen.findByRole('alert');
    const first = vi.mocked(receiveStock).mock.calls[0][2];
    fireEvent.click(screen.getByRole('button', { name: 'Receive stock' }));
    await waitFor(() => expect(receiveStock).toHaveBeenCalledTimes(2));
    await screen.findByRole('alert');
    expect(vi.mocked(receiveStock).mock.calls[1][2]).toEqual(first);
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Units to receive' }),
      { target: { value: '4' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Receive stock' }));
    await waitFor(() => expect(receiveStock).toHaveBeenCalledTimes(3));
    expect(vi.mocked(receiveStock).mock.calls[2][2].requestId).not.toBe(
      first.requestId,
    );
    expect(first).toMatchObject({ quantity: 3, requestId: expect.any(String) });
    expect(first).not.toHaveProperty('reason');
  });
  it('confirms signed adjustment and estimate without trusting stale balance', async () => {
    vi.mocked(adjustStock).mockResolvedValue({} as never);
    const onSaved = vi.fn();
    render(
      <InventoryStockForm
        scope={scope}
        inventory={inventory}
        mode="adjustment"
        onSaved={onSaved}
        onPendingChange={vi.fn()}
      />,
    );
    fill('-7', 'adjustment');
    fireEvent.click(screen.getByRole('button', { name: 'Review adjustment' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Review the complete change before applying it:',
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Product: Vase · SKU VA',
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Current stock: 5 units',
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Adjustment method: Quantity change',
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Quantity change: -7 units',
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Net stock change: -7 units',
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Estimated stock after adjustment: -2 units',
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Reason: Delivery',
    );
    expect(adjustStock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply adjustment' }));
    await waitFor(() =>
      expect(adjustStock).toHaveBeenCalledWith(
        request,
        scope,
        expect.objectContaining({ quantityChange: -7, reason: 'Delivery' }),
      ),
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
  it('filters unsupported receipt characters while validating with debounce', async () => {
    vi.useFakeTimers();
    render(
      <InventoryStockForm
        scope={scope}
        inventory={inventory}
        mode="receipt"
        onSaved={vi.fn()}
        onPendingChange={vi.fn()}
      />,
    );
    const quantity = screen.getByRole('textbox', { name: 'Units to receive' });
    fireEvent.change(quantity, { target: { value: '1a' } });
    expect(quantity).toHaveValue('1');
    expect(quantity).not.toHaveAttribute('aria-invalid', 'true');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(quantity).not.toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.queryByRole('textbox', { name: 'Reason' }),
    ).not.toBeInTheDocument();
  });
  it('supports an absolute stock target and filters negative or letter input', async () => {
    vi.mocked(adjustStock).mockResolvedValue({} as never);
    render(
      <InventoryStockForm
        scope={scope}
        inventory={inventory}
        mode="adjustment"
        onSaved={vi.fn()}
        onPendingChange={vi.fn()}
      />,
    );
    const method = screen.getByRole('combobox', {
      name: 'Adjustment method',
    });
    expect(method).toHaveTextContent('New stock value');
    const target = screen.getByRole('textbox', { name: 'New stock value' });
    fireEvent.change(target, { target: { value: '-8x' } });
    expect(target).toHaveValue('8');
    fireEvent.click(method);
    fireEvent.click(screen.getByRole('option', { name: 'Quantity change' }));
    const change = screen.getByRole('textbox', { name: 'Quantity change' });
    fireEvent.change(change, { target: { value: '+2a' } });
    expect(change).toHaveValue('+2');
    expect(
      screen.queryByRole('textbox', { name: 'Quantity change' }),
    ).toBeInTheDocument();
    fireEvent.click(method);
    fireEvent.click(screen.getByRole('option', { name: 'New stock value' }));
    const nextTarget = screen.getByRole('textbox', { name: 'New stock value' });
    fireEvent.change(nextTarget, { target: { value: '8' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'Count correction' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review adjustment' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Adjustment method: New stock value',
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'New stock value: 8 units',
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Net stock change: +3 units',
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Estimated stock after adjustment: 8 units',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply adjustment' }));
    await waitFor(() =>
      expect(adjustStock).toHaveBeenCalledWith(
        request,
        scope,
        expect.objectContaining({
          newQuantity: 8,
          reason: 'Count correction',
        }),
      ),
    );
  });
  it('fills an adjustment reason from a common-reason action and permits custom text', () => {
    render(
      <InventoryStockForm
        scope={scope}
        inventory={inventory}
        mode="adjustment"
        onSaved={vi.fn()}
        onPendingChange={vi.fn()}
      />,
    );
    const reason = screen.getByRole('textbox', { name: 'Reason' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Stock count correction' }),
    );
    expect(reason).toHaveValue('Stock count correction');
    expect(
      screen.getByRole('button', { name: 'Stock count correction' }),
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(reason, { target: { value: 'Shipment PO-1042' } });
    expect(reason).toHaveValue('Shipment PO-1042');
  });
  it('blocks inactive receiving and leaves corrections available', () => {
    const inactive = {
      ...inventory,
      product: { ...inventory.product, status: 'INACTIVE' as const },
    };
    const { rerender } = render(
      <InventoryStockForm
        scope={scope}
        inventory={inactive}
        mode="receipt"
        onSaved={vi.fn()}
        onPendingChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Receive stock' }),
    ).toBeDisabled();
    rerender(
      <InventoryStockForm
        scope={scope}
        inventory={inactive}
        mode="adjustment"
        onSaved={vi.fn()}
        onPendingChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Review adjustment' }),
    ).not.toBeDisabled();
  });
  it.each(['receipt', 'adjustment'] as const)(
    'allows cancelling the %s form without submitting',
    (mode) => {
      const onCancel = vi.fn();
      render(
        <InventoryStockForm
          scope={scope}
          inventory={inventory}
          mode={mode}
          onSaved={vi.fn()}
          onPendingChange={vi.fn()}
          onCancel={onCancel}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(receiveStock).not.toHaveBeenCalled();
      expect(adjustStock).not.toHaveBeenCalled();
    },
  );
});
