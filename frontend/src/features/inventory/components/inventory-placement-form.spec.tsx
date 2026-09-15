import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { listMerchants } from '@/features/merchants/api/merchant-api';
import { listProducts } from '@/features/products/api/product-api';
import {
  merchant,
  product,
} from '@/features/products/model/product.test-fixtures';
import { createPlacement, listInventory } from '../api/inventory-api';
import { inventory, scope } from '../model/inventory.test-fixtures';
import { InventoryPlacementForm } from './inventory-placement-form';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/features/merchants/api/merchant-api', () => ({
  listMerchants: vi.fn(),
}));
vi.mock('@/features/products/api/product-api', () => ({
  listProducts: vi.fn(),
}));
vi.mock('../api/inventory-api', () => ({
  createPlacement: vi.fn(),
  listInventory: vi.fn(),
}));

describe('InventoryPlacementForm', () => {
  const request = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({ request } as never);
    vi.mocked(listProducts).mockResolvedValue([product]);
    vi.mocked(listMerchants).mockResolvedValue([merchant]);
    vi.mocked(listInventory).mockResolvedValue([]);
  });
  const select = async () => {
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Product' }),
      ).not.toBeDisabled(),
    );
    fireEvent.focus(screen.getByRole('combobox', { name: 'Product' }));
    fireEvent.click(
      screen.getByRole('option', { name: `${product.name} · ${product.sku}` }),
    );
  };
  it('creates a placement with a decimal-string price and no opening stock', async () => {
    vi.mocked(createPlacement).mockResolvedValue({ ...inventory, quantity: 0 });
    const onSaved = vi.fn();
    render(
      <InventoryPlacementForm
        scope={scope}
        onSaved={onSaved}
        onCancel={vi.fn()}
        onPendingChange={vi.fn()}
      />,
    );
    await select();
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Selling price (PHP)' }),
      { target: { value: ' 925.50 ' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create placement' }));
    await waitFor(() =>
      expect(createPlacement).toHaveBeenCalledWith(request, scope, {
        productId: product.id,
        sellingPrice: '925.50',
        lowStockThreshold: 5,
      }),
    );
    expect(onSaved).toHaveBeenCalledOnce();
  });
  it('excludes already-placed products and products without active merchants', async () => {
    vi.mocked(listInventory).mockResolvedValue([inventory]);
    vi.mocked(listProducts).mockResolvedValue([
      product,
      {
        ...product,
        id: '11111111-1111-4111-8111-111111111111',
        merchantId: '22222222-2222-4222-8222-222222222222',
      },
    ]);
    render(
      <InventoryPlacementForm
        scope={scope}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        onPendingChange={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Product' }),
      ).not.toBeDisabled(),
    );
    expect(
      screen.getByRole('button', { name: 'Create placement' }),
    ).toBeDisabled();
    expect(listProducts).toHaveBeenCalledWith(request, scope.organizationId, {
      status: 'ACTIVE',
      q: undefined,
    });
    expect(listMerchants).toHaveBeenCalledWith(request, scope.organizationId, {
      status: 'ACTIVE',
    });
  });
  it('debounces organization-scoped product search', async () => {
    render(
      <InventoryPlacementForm
        scope={scope}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        onPendingChange={vi.fn()}
      />,
    );
    await select();
    fireEvent.change(screen.getByRole('combobox', { name: 'Product' }), {
      target: { value: '001Ab' },
    });
    await waitFor(() =>
      expect(listProducts).toHaveBeenLastCalledWith(
        request,
        scope.organizationId,
        { status: 'ACTIVE', q: '001Ab' },
      ),
    );
  });
  it('uses one searchable product picker and supports Enter selection', async () => {
    render(
      <InventoryPlacementForm
        scope={scope}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        onPendingChange={vi.fn()}
      />,
    );
    const picker = await screen.findByRole('combobox', { name: 'Product' });
    await waitFor(() => expect(picker).toBeEnabled());
    expect(screen.queryByText('Choose a product')).not.toBeInTheDocument();
    fireEvent.focus(picker);
    fireEvent.keyDown(picker, { key: 'Enter' });
    expect(picker).toHaveValue(`${product.name} · ${product.sku}`);
    expect(screen.getByText(/Selected:/)).toHaveTextContent(product.name);
  });
  it('preserves inputs after a placement conflict', async () => {
    vi.mocked(createPlacement).mockRejectedValue(
      new ApiError(409, 'Product is already placed in this branch'),
    );
    render(
      <InventoryPlacementForm
        scope={scope}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        onPendingChange={vi.fn()}
      />,
    );
    await select();
    const price = screen.getByRole('textbox', { name: 'Selling price (PHP)' });
    fireEvent.change(price, { target: { value: '12.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create placement' }));
    await screen.findByRole('alert');
    expect(price).toHaveValue('12.50');
    expect(
      screen.getByRole('button', { name: 'Create placement' }),
    ).not.toBeDisabled();
  });
});
