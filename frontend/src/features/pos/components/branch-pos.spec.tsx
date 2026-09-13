import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { getPosBranch, lookupPosCode, searchPosProducts } from '../api/pos-api';
import { allowPosNavigation } from '../model/pos-navigation';
import {
  product,
  secondProduct,
  scope,
  completedSale,
} from '../model/pos.test-fixtures';
import { BranchPos } from './branch-pos';
import { setCheckoutAttempt } from '../model/checkout-attempt';
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('../api/pos-api', () => ({
  getPosBranch: vi.fn(),
  lookupPosCode: vi.fn(),
  searchPosProducts: vi.fn(),
}));
describe('Branch POS cart workflows', () => {
  const request = vi.fn();
  const workspace = (role = 'OWNER', id = scope.organizationId) =>
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { id, role },
      organizationStatus: 'ready',
    } as never);
  const codeInput = () =>
    screen.getByRole('textbox', { name: 'SKU or barcode' });
  const enterCode = (code = '001Ab') => {
    fireEvent.change(codeInput(), { target: { value: code } });
    fireEvent.keyDown(codeInput(), { key: 'Enter' });
  };
  beforeEach(() => {
    setCheckoutAttempt(`${scope.organizationId}:actor`, null);
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      request,
      user: { id: 'actor' },
    } as never);
    workspace();
    vi.mocked(getPosBranch).mockResolvedValue({
      id: scope.branchId,
      name: 'Makati',
      code: 'MKT',
    });
    vi.mocked(searchPosProducts).mockResolvedValue([product]);
    vi.mocked(lookupPosCode).mockResolvedValue([product]);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it.each(['OWNER', 'MANAGER', 'CASHIER'])(
    'loads only branch/POS reads for %s, with payment disabled for an empty cart',
    async (role) => {
      workspace(role);
      render(<BranchPos {...scope} />);
      await screen.findByRole('button', { name: `Add ${product.name}` });
      expect(getPosBranch).toHaveBeenCalledWith(request, scope, role);
      expect(searchPosProducts).toHaveBeenCalledWith(request, scope, '');
      expect(
        screen.getByRole('button', { name: 'Review payment' }),
      ).toBeDisabled();
      expect(request).not.toHaveBeenCalled();
    },
  );
  it('denies merchant direct routes without any branch/catalog request', () => {
    workspace('MERCHANT');
    render(<BranchPos {...scope} />);
    expect(screen.getByRole('alert')).toHaveTextContent('cannot access POS');
    expect(getPosBranch).not.toHaveBeenCalled();
    expect(searchPosProducts).not.toHaveBeenCalled();
  });
  it('adds on Enter, repeats quantity and restores code-input focus without checkout submission', async () => {
    render(<BranchPos {...scope} />);
    await screen.findByRole('button', { name: `Add ${product.name}` });
    enterCode();
    const quantity = await screen.findByRole('textbox', {
      name: `Quantity for ${product.name}`,
    });
    expect(quantity).toHaveValue('1');
    expect(codeInput()).toHaveValue('');
    enterCode();
    await waitFor(() => expect(quantity).toHaveValue('2'));
    expect(screen.getByLabelText('Estimated total')).toHaveTextContent(
      '1700.00',
    );
    await waitFor(() => expect(codeInput()).toHaveFocus());
    expect(lookupPosCode).toHaveBeenCalledTimes(2);
  });
  async function startPayment() {
    await screen.findByRole('button', { name: `Add ${product.name}` });
    enterCode();
    await screen.findByRole('textbox', {
      name: `Quantity for ${product.name}`,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review payment' }));
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Cash tender (PHP)' }),
      { target: { value: '1000' } },
    );
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
  }
  it('clears a successful cart and retries a failed catalog read without completing again', async () => {
    request.mockResolvedValue(completedSale);
    render(<BranchPos {...scope} />);
    await screen.findByRole('button', { name: `Add ${product.name}` });
    vi.mocked(searchPosProducts).mockRejectedValueOnce(
      new ApiError(503, 'Catalog refresh unavailable'),
    );
    await startPayment();
    await screen.findByText('Sale completed');
    expect(screen.getByLabelText('Estimated total')).toHaveTextContent('0.00');
    expect(
      screen.getByRole('button', { name: 'Review payment' }),
    ).toBeDisabled();
    expect(screen.getAllByText('Saved Store')).toHaveLength(2);
    await screen.findByText('Catalog refresh unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('button', { name: `Add ${product.name}` });
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Receipt SALE-SAVED-001')).toHaveLength(2);
  });
  it('requires explicit re-review after a price conflict and uses a new ID only for the changed command', async () => {
    request
      .mockRejectedValueOnce(
        new ApiError(409, 'Branch price changed', {
          code: 'PRICE_CHANGED',
          branchInventoryId: product.branchInventoryId,
          sellingPrice: '900.00',
        }),
      )
      .mockResolvedValueOnce({
        ...completedSale,
        total: '900.00',
        cashChange: '100.00',
        items: [
          {
            ...completedSale.items[0],
            unitPrice: '900.00',
            lineTotal: '900.00',
          },
        ],
      });
    render(<BranchPos {...scope} />);
    await startPayment();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Estimated total')).toHaveTextContent(
      '900.00',
    );
    expect(request).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Review payment' }));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
    await screen.findByText('Sale completed');
    const first = JSON.parse(request.mock.calls[0][1].body);
    const second = JSON.parse(request.mock.calls[1][1].body);
    expect(first.items[0].expectedUnitPrice).toBe('850.00');
    expect(second.items[0].expectedUnitPrice).toBe('900.00');
    expect(second.requestId).not.toBe(first.requestId);
  });
  it.each(['INSUFFICIENT_STOCK', 'PRODUCT_UNAVAILABLE'])(
    'blocks payment until a %s line is corrected or removed',
    async (code) => {
      request.mockRejectedValueOnce(
        new ApiError(409, 'Product cannot be sold', {
          code,
          branchInventoryId: product.branchInventoryId,
          quantity: 0,
        }),
      );
      render(<BranchPos {...scope} />);
      await startPayment();
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      expect(
        screen.getByRole('button', { name: 'Review payment' }),
      ).toBeDisabled();
      expect(
        screen.getByRole('textbox', { name: `Quantity for ${product.name}` }),
      ).toHaveAttribute('aria-invalid', 'true');
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it('blocks voluntary navigation and recovers an uncertain command after a forced route unmount', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    request
      .mockRejectedValueOnce(new TypeError('response lost'))
      .mockResolvedValueOnce(completedSale);
    const view = render(<BranchPos {...scope} />);
    await startPayment();
    await screen.findByRole('button', { name: 'Retry same checkout' });
    let allowed = true;
    act(() => {
      allowed = allowPosNavigation('/app/organizations/another');
    });
    expect(allowed).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const first = JSON.parse(request.mock.calls[0][1].body);
    view.unmount();
    const another = render(
      <BranchPos {...scope} branchId={secondProduct.productId} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/earlier checkout/);
    act(() => {
      allowed = allowPosNavigation(
        `/app/organizations/${scope.organizationId}/branches/${scope.branchId}/pos`,
      );
    });
    expect(allowed).toBe(true);
    another.unmount();
    render(<BranchPos {...scope} />);
    expect(
      screen.getByRole('textbox', { name: 'Cash tender (PHP)' }),
    ).toHaveValue('1000.00');
    expect(
      screen.getByRole('textbox', { name: 'Cash tender (PHP)' }),
    ).toBeDisabled();
    expect(request).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry same checkout' }),
    );
    await screen.findByText('Sale completed');
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual(first);
  });
  it('recovers a response completed while unmounted without another write', async () => {
    let resolve!: (value: typeof completedSale) => void;
    request.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const view = render(<BranchPos {...scope} />);
    await startPayment();
    view.unmount();
    await act(async () => {
      resolve(completedSale);
    });
    render(<BranchPos {...scope} />);
    await screen.findByText('Sale completed');
    expect(screen.getByLabelText('Estimated total')).toHaveTextContent('0.00');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('guards duplicate in-flight Enter and excludes cart edits during lookup', async () => {
    let finish!: (rows: (typeof product)[]) => void;
    vi.mocked(lookupPosCode).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<BranchPos {...scope} />);
    await screen.findByRole('button', { name: `Add ${product.name}` });
    enterCode();
    fireEvent.keyDown(codeInput(), { key: 'Enter' });
    expect(lookupPosCode).toHaveBeenCalledTimes(1);
    expect(codeInput()).toBeDisabled();
    await act(async () => finish([product]));
    expect(
      await screen.findByRole('textbox', {
        name: `Quantity for ${product.name}`,
      }),
    ).toHaveValue('1');
  });
  it('requires explicit ambiguity selection and cancels without adding', async () => {
    vi.mocked(lookupPosCode).mockResolvedValue([product, secondProduct]);
    render(<BranchPos {...scope} />);
    await screen.findByRole('button', { name: `Add ${product.name}` });
    enterCode('AMIHAN-VASE');
    const dialog = await screen.findByRole('dialog', {
      name: 'Choose the matching product',
    });
    expect(screen.getByLabelText('Estimated total')).toHaveTextContent('0.00');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    enterCode('AMIHAN-VASE');
    const next = await screen.findByRole('dialog');
    fireEvent.click(
      within(next).getByRole('button', {
        name: `Choose ${secondProduct.name}`,
      }),
    );
    expect(
      await screen.findByRole('textbox', {
        name: `Quantity for ${secondProduct.name}`,
      }),
    ).toHaveValue('1');
    expect(screen.getByLabelText('Estimated total')).toHaveTextContent(
      '250.00',
    );
  });
  it('does not add unknown or out-of-stock codes and disables zero-stock search rows', async () => {
    vi.mocked(searchPosProducts).mockResolvedValue([
      { ...product, quantity: 0, eligible: false },
    ]);
    vi.mocked(lookupPosCode).mockResolvedValue([]);
    render(<BranchPos {...scope} />);
    expect(
      await screen.findByRole('button', { name: `Add ${product.name}` }),
    ).toBeDisabled();
    enterCode();
    await screen.findByText(/No active placed product matches/);
    vi.mocked(lookupPosCode).mockResolvedValue([
      { ...product, quantity: 0, eligible: false },
    ]);
    enterCode();
    await screen.findByText(`${product.name} is out of stock.`);
    expect(screen.getByLabelText('Estimated total')).toHaveTextContent('0.00');
  });
  it('validates quantities after 300ms and immediately on blur while keeping exact estimates', async () => {
    render(<BranchPos {...scope} />);
    await screen.findByRole('button', { name: `Add ${product.name}` });
    enterCode();
    const quantity = await screen.findByRole('textbox', {
      name: `Quantity for ${product.name}`,
    });
    vi.useFakeTimers();
    fireEvent.change(quantity, { target: { value: '1.5' } });
    expect(quantity).not.toHaveAttribute('aria-invalid', 'true');
    await act(async () => vi.advanceTimersByTime(300));
    expect(quantity).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(quantity, { target: { value: '11' } });
    fireEvent.blur(quantity);
    expect(
      screen.getByText('Only 10 units are currently available.'),
    ).toBeInTheDocument();
    fireEvent.change(quantity, { target: { value: '3' } });
    fireEvent.blur(quantity);
    expect(quantity).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Estimated total')).toHaveTextContent(
      '2550.00',
    );
  });
  it('debounces every code input and rejects malformed input before lookup', async () => {
    render(<BranchPos {...scope} />);
    await screen.findByRole('button', { name: `Add ${product.name}` });
    vi.useFakeTimers();
    fireEvent.change(codeInput(), { target: { value: 'bad code' } });
    await act(async () => vi.advanceTimersByTime(300));
    expect(codeInput()).toHaveAttribute('aria-invalid', 'true');
    fireEvent.keyDown(codeInput(), { key: 'Enter' });
    expect(lookupPosCode).not.toHaveBeenCalled();
  });
  it('searches after debounce without discarding its cart', async () => {
    render(<BranchPos {...scope} />);
    await screen.findByRole('button', { name: `Add ${product.name}` });
    enterCode();
    await screen.findByRole('textbox', {
      name: `Quantity for ${product.name}`,
    });
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search products' }),
      { target: { value: '001Ab' } },
    );
    await waitFor(() =>
      expect(searchPosProducts).toHaveBeenLastCalledWith(
        request,
        scope,
        '001Ab',
      ),
    );
    expect(screen.getByLabelText('Estimated total')).toHaveTextContent(
      '850.00',
    );
  });
  it('confirms clearing, supports cancellation and removes individual lines', async () => {
    render(<BranchPos {...scope} />);
    await screen.findByRole('button', { name: `Add ${product.name}` });
    enterCode();
    await screen.findByRole('textbox', {
      name: `Quantity for ${product.name}`,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Clear cart' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Cancel',
      }),
    );
    expect(screen.getByLabelText('Estimated total')).toHaveTextContent(
      '850.00',
    );
    fireEvent.click(
      screen.getByRole('button', { name: `Remove ${product.name}` }),
    );
    expect(screen.getByLabelText('Estimated total')).toHaveTextContent('0.00');
    enterCode();
    await screen.findByRole('button', { name: 'Clear cart' });
    fireEvent.click(screen.getByRole('button', { name: 'Clear cart' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Discard cart',
      }),
    );
    expect(screen.getByLabelText('Estimated total')).toHaveTextContent('0.00');
  });
  it('clears cart/data on access denial and offers a read-only access retry', async () => {
    render(<BranchPos {...scope} />);
    await screen.findByRole('button', { name: `Add ${product.name}` });
    enterCode();
    await screen.findByRole('textbox', {
      name: `Quantity for ${product.name}`,
    });
    vi.mocked(lookupPosCode).mockRejectedValue(new ApiError(403, 'Denied'));
    enterCode();
    await screen.findByText(/POS access is unavailable/);
    expect(
      screen.queryByRole('textbox', { name: `Quantity for ${product.name}` }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByLabelText('Estimated total');
    expect(screen.getByLabelText('Estimated total')).toHaveTextContent('0.00');
    expect(lookupPosCode).toHaveBeenCalledTimes(2);
  });
  it('ignores an obsolete lookup after branch scope changes', async () => {
    let finish!: (rows: (typeof product)[]) => void;
    vi.mocked(lookupPosCode).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const view = render(<BranchPos {...scope} />);
    await screen.findByRole('button', { name: `Add ${product.name}` });
    enterCode();
    view.rerender(
      <BranchPos {...scope} branchId={secondProduct.branchInventoryId} />,
    );
    await screen.findByLabelText('Estimated total');
    await act(async () => finish([product]));
    expect(screen.getByLabelText('Estimated total')).toHaveTextContent('0.00');
  });
  it('warns before programmatic organization switching or leaving through a link', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<BranchPos {...scope} />);
    await screen.findByRole('button', { name: `Add ${product.name}` });
    enterCode();
    await screen.findByRole('textbox', {
      name: `Quantity for ${product.name}`,
    });
    let allowed = true;
    act(() => {
      allowed = allowPosNavigation('/app/organizations/another');
    });
    expect(allowed).toBe(false);
    expect(screen.getByLabelText('Estimated total')).toHaveTextContent(
      '850.00',
    );
    fireEvent.click(screen.getByRole('link', { name: 'Back to branch' }));
    expect(confirm).toHaveBeenCalledTimes(2);
    confirm.mockReturnValue(true);
    act(() => {
      allowed = allowPosNavigation('/app/organizations/another');
    });
    expect(allowed).toBe(true);
    expect(screen.getByLabelText('Estimated total')).toHaveTextContent('0.00');
  });
});
