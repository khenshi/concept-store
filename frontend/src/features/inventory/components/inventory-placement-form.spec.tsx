import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { product } from '@/features/products/model/product.test-fixtures';
import { createPlacement, listEligibleProducts } from '../api/inventory-api';
import { inventory, scope } from '../model/inventory.test-fixtures';
import { InventoryPlacementForm } from './inventory-placement-form';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../api/inventory-api', () => ({
  createPlacement: vi.fn(),
  listEligibleProducts: vi.fn(),
}));

describe('InventoryPlacementForm', () => {
  const request = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({ request } as never);
    vi.mocked(listEligibleProducts).mockResolvedValue({
      items: [product],
      nextCursor: null,
    });
  });
  const select = async () => {
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Product' }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Product' }));
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
  it('uses only branch-scoped eligible products returned by the server', async () => {
    vi.mocked(listEligibleProducts).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
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
    expect(listEligibleProducts).toHaveBeenCalledWith(
      request,
      { organizationId: scope.organizationId, branchId: scope.branchId },
      undefined,
    );
  });
  it('debounces branch-scoped eligible-product search', async () => {
    render(
      <InventoryPlacementForm
        scope={scope}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        onPendingChange={vi.fn()}
      />,
    );
    await select();
    await waitFor(() =>
      expect(listEligibleProducts).toHaveBeenLastCalledWith(
        request,
        { organizationId: scope.organizationId, branchId: scope.branchId },
        `${product.name} · ${product.sku}`,
      ),
    );
    const callsBeforeSearch = vi.mocked(listEligibleProducts).mock.calls.length;
    fireEvent.click(screen.getByRole('combobox', { name: 'Product' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Product' }), {
      target: { value: '001Ab' },
    });
    expect(
      screen.getByRole('option', { name: `${product.name} · ${product.sku}` }),
    ).toBeInTheDocument();
    expect(listEligibleProducts).toHaveBeenCalledTimes(callsBeforeSearch);
    await waitFor(() =>
      expect(listEligibleProducts).toHaveBeenLastCalledWith(
        request,
        { organizationId: scope.organizationId, branchId: scope.branchId },
        '001Ab',
      ),
    );
  });
  it('loads more eligible products and ignores stale later-page responses', async () => {
    const cursor = `${product.id}.${'a'.repeat(64)}`;
    const second = {
      ...product,
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Second eligible product',
    };
    let finish!: (page: {
      items: (typeof product)[];
      nextCursor: null;
    }) => void;
    vi.mocked(listEligibleProducts)
      .mockResolvedValueOnce({ items: [product], nextCursor: cursor })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      )
      .mockResolvedValueOnce({ items: [], nextCursor: null });
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
    fireEvent.click(picker);
    fireEvent.click(screen.getByRole('button', { name: 'Load more products' }));
    expect(listEligibleProducts).toHaveBeenLastCalledWith(
      request,
      { organizationId: scope.organizationId, branchId: scope.branchId },
      undefined,
      cursor,
    );
    fireEvent.change(picker, { target: { value: 'new' } });
    await waitFor(() => expect(listEligibleProducts).toHaveBeenCalledTimes(3));
    await act(async () => finish({ items: [second], nextCursor: null }));
    expect(
      screen.queryByRole('option', { name: `${second.name} · ${second.sku}` }),
    ).not.toBeInTheDocument();
  });
  it('makes later-page products selectable by keyboard', async () => {
    const cursor = `${product.id}.${'a'.repeat(64)}`;
    const second = {
      ...product,
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Second eligible product',
    };
    vi.mocked(listEligibleProducts)
      .mockResolvedValueOnce({ items: [product], nextCursor: cursor })
      .mockResolvedValueOnce({ items: [second], nextCursor: null });
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
    fireEvent.click(picker);
    fireEvent.click(screen.getByRole('button', { name: 'Load more products' }));
    const option = await screen.findByRole('option', {
      name: `${second.name} · ${second.sku}`,
    });
    option.focus();
    fireEvent.keyDown(option, { key: 'ArrowUp' });
    expect(
      screen.getByRole('option', { name: `${product.name} · ${product.sku}` }),
    ).toHaveFocus();
    fireEvent.click(option);
    expect(picker).toHaveValue(`${second.name} · ${second.sku}`);
  });
  it('retries a failed later candidate page without losing the current choice', async () => {
    const cursor = `${product.id}.${'a'.repeat(64)}`;
    vi.mocked(listEligibleProducts)
      .mockResolvedValueOnce({ items: [product], nextCursor: cursor })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ items: [], nextCursor: null });
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
    fireEvent.click(picker);
    fireEvent.click(screen.getByRole('button', { name: 'Load more products' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'More available products could not be loaded',
    );
    expect(
      screen.getByRole('option', { name: `${product.name} · ${product.sku}` }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading more' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Retry loading more' }),
      ).not.toBeInTheDocument(),
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
    expect(picker).toHaveValue('');
    expect(picker).toHaveAttribute(
      'placeholder',
      'Search by name, SKU, or barcode',
    );
    fireEvent.click(picker);
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
