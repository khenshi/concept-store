import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { listBranches } from '@/features/branches/api/branch-api';
import { createProduct } from '../api/product-api';
import {
  merchant,
  organizationId,
  placement,
  product,
} from '../model/product.test-fixtures';
import { ProductForm } from './product-form';

vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/features/branches/api/branch-api', () => ({
  listBranches: vi.fn(),
}));
vi.mock('../api/product-api', () => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
}));
describe('Optional new-product opening stock', () => {
  const request = vi.fn();
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  const onPendingChange = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({ request } as never);
    vi.mocked(listBranches).mockResolvedValue([placement.branch]);
    vi.mocked(createProduct).mockResolvedValue(product);
  });
  afterEach(() => vi.useRealTimers());
  function setup() {
    return render(
      <ProductForm
        organizationId={organizationId}
        merchants={[merchant]}
        onSaved={onSaved}
        onCancel={onCancel}
        onPendingChange={onPendingChange}
      />,
    );
  }
  function identity() {
    fireEvent.click(screen.getByRole('combobox', { name: 'Merchant' }));
    fireEvent.click(screen.getByRole('option', { name: merchant.name }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Product name' }), {
      target: { value: ' Vase ' },
    });
  }
  async function opening() {
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Add initial stock' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Initial stock branch' }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole('combobox', { name: 'Initial stock branch' }),
    );
    fireEvent.click(screen.getByRole('option', { name: 'Makati · MKT' }));
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Branch selling price (PHP)' }),
      { target: { value: ' 12.50 ' } },
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Initial stock quantity' }),
      { target: { value: '3' } },
    );
  }
  it('defaults off and keeps legacy creation free of branch reads and stock fields', async () => {
    setup();
    identity();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Create product' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(product, false));
    expect(createProduct).toHaveBeenCalledWith(request, organizationId, {
      merchantId: merchant.id,
      name: 'Vase',
      sku: null,
      barcode: null,
    });
    expect(listBranches).not.toHaveBeenCalled();
  });
  it('requires explicit selection even with one branch and focuses the invalid branch', async () => {
    setup();
    identity();
    fireEvent.click(screen.getByRole('checkbox'));
    const branch = screen.getByRole('combobox', {
      name: 'Initial stock branch',
    });
    await waitFor(() => expect(branch).toBeEnabled());
    expect(branch).toHaveTextContent('Choose a branch');
    fireEvent.click(screen.getByRole('button', { name: 'Create product' }));
    expect(branch).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(branch).toHaveFocus());
    expect(createProduct).not.toHaveBeenCalled();
  });
  it('creates one atomic command with the chosen branch, precise text price and numeric units', async () => {
    setup();
    identity();
    await opening();
    fireEvent.click(screen.getByRole('button', { name: 'Create product' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(product, true));
    expect(createProduct).toHaveBeenCalledWith(request, organizationId, {
      merchantId: merchant.id,
      name: 'Vase',
      sku: null,
      barcode: null,
      requestId: expect.stringMatching(/^[\da-f-]{36}$/),
      initialInventory: {
        branchId: placement.branchId,
        sellingPrice: '12.50',
        quantity: 3,
      },
    });
    expect(createProduct).toHaveBeenCalledTimes(1);
    expect(listBranches).toHaveBeenCalledWith(request, organizationId, 'OWNER');
  });
  it('validates quantity and price on input after 300ms and immediately on blur', async () => {
    setup();
    await opening();
    vi.useFakeTimers();
    const quantity = screen.getByRole('textbox', {
      name: 'Initial stock quantity',
    });
    const price = screen.getByRole('textbox', {
      name: 'Branch selling price (PHP)',
    });
    fireEvent.change(quantity, { target: { value: '1.5' } });
    expect(quantity).not.toHaveAttribute('aria-invalid', 'true');
    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(quantity).not.toHaveAttribute('aria-invalid', 'true');
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(quantity).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(quantity, { target: { value: '5' } });
    fireEvent.blur(quantity);
    expect(quantity).not.toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(price, { target: { value: '0' } });
    fireEvent.blur(price);
    expect(price).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(price, { target: { value: '0.01' } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(price).not.toHaveAttribute('aria-invalid', 'true');
  });
  it('disabling the section clears stock controls and validation without sending stock', async () => {
    setup();
    identity();
    await opening();
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Initial stock quantity' }),
      { target: { value: '0' } },
    );
    fireEvent.blur(
      screen.getByRole('textbox', { name: 'Initial stock quantity' }),
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(
      screen.queryByRole('textbox', { name: 'Initial stock quantity' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create product' }));
    await waitFor(() => expect(createProduct).toHaveBeenCalled());
    expect(vi.mocked(createProduct).mock.calls[0][2]).not.toHaveProperty(
      'initialInventory',
    );
    expect(vi.mocked(createProduct).mock.calls[0][2]).not.toHaveProperty(
      'requestId',
    );
  });
  it('blocks enabled creation during branch loading and after read failure, with read-only retry', async () => {
    vi.mocked(listBranches)
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce([placement.branch]);
    setup();
    identity();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(
      screen.getByRole('button', { name: 'Create product' }),
    ).toBeDisabled();
    await screen.findByRole('button', { name: 'Retry branches' });
    expect(
      screen.getByRole('button', { name: 'Create product' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry branches' }));
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Initial stock branch' }),
      ).toBeEnabled(),
    );
    expect(createProduct).not.toHaveBeenCalled();
  });
  it('explains an empty branch directory without falling back to product-only creation', async () => {
    vi.mocked(listBranches).mockResolvedValue([]);
    setup();
    fireEvent.click(screen.getByRole('checkbox'));
    await screen.findByText('Add a branch before adding initial stock.');
    expect(
      screen.getByRole('button', { name: 'Create product' }),
    ).toBeDisabled();
    expect(createProduct).not.toHaveBeenCalled();
  });
  it('ignores branch results after the opening section is disabled', async () => {
    let resolve!: (value: (typeof placement.branch)[]) => void;
    vi.mocked(listBranches).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    setup();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('checkbox'));
    await act(async () => resolve([placement.branch]));
    expect(
      screen.queryByRole('combobox', { name: 'Initial stock branch' }),
    ).not.toBeInTheDocument();
  });
  it('locks fields, dismissal and navigation while pending and suppresses repeat submission', async () => {
    vi.mocked(createProduct).mockReturnValue(new Promise(() => {}));
    const view = setup();
    identity();
    await opening();
    fireEvent.click(screen.getByRole('button', { name: 'Create product' }));
    fireEvent.submit(view.container.querySelector('form')!);
    expect(createProduct).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Initial stock branch' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('textbox', { name: 'Product name' }),
    ).toBeDisabled();
    expect(onPendingChange).toHaveBeenLastCalledWith(true);
    const link = document.createElement('a');
    link.href = '/other';
    document.body.append(link);
    expect(
      link.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      ),
    ).toBe(false);
    link.remove();
  });
  it('freezes unknown-outcome input and retains exactly the same request across failed explicit retries', async () => {
    vi.mocked(createProduct)
      .mockRejectedValueOnce(new Error('Network loss'))
      .mockRejectedValueOnce(new Error('Still offline'))
      .mockResolvedValueOnce(product);
    const view = setup();
    identity();
    await opening();
    fireEvent.click(screen.getByRole('button', { name: 'Create product' }));
    await screen.findByRole('button', { name: 'Retry same creation' });
    const original = vi.mocked(createProduct).mock.calls[0][2];
    expect(
      screen.getByRole('textbox', { name: 'Product name' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(onPendingChange).toHaveBeenLastCalledWith(true);
    expect(onSaved).not.toHaveBeenCalled();
    // Even tampered DOM input cannot change the frozen retry payload.
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Initial stock quantity' }),
      { target: { value: '100' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry same creation' }),
    );
    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(2));
    await screen.findByRole('button', { name: 'Retry same creation' });
    fireEvent.submit(view.container.querySelector('form')!);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(product, true));
    expect(vi.mocked(createProduct).mock.calls.map((call) => call[2])).toEqual([
      original,
      original,
      original,
    ]);
    expect(onPendingChange).toHaveBeenLastCalledWith(false);
  });
  it('never offers opening stock when editing an existing product', () => {
    render(
      <ProductForm
        organizationId={organizationId}
        merchants={[merchant]}
        product={product}
        onSaved={onSaved}
        onCancel={onCancel}
      />,
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(listBranches).not.toHaveBeenCalled();
  });
});
