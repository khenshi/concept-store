import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { ApiError } from '@/features/auth/api/auth-client';
import {
  scope,
  completedSale,
  product,
} from '@/features/pos/model/pos.test-fixtures';
import {
  ownPage,
  ownSale,
  staffPage,
  sellingBranches,
} from '../model/sales.test-fixtures';
import { MerchantSalesBranches } from './merchant-sales-branches';
import { BranchSales } from './branch-sales';
import { SaleDetail } from './sale-detail';
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
describe('read-only scoped sales workflows', () => {
  const request = vi.fn();
  const refreshOrganization = vi.fn();
  function workspace(role = 'MERCHANT', id = scope.organizationId) {
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { id, role },
      organizationStatus: 'ready',
      refreshOrganization,
    } as never);
  }
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      request,
      user: { id: 'actor' },
    } as never);
    workspace();
  });
  afterEach(() => vi.restoreAllMocks());
  it('discovers historical merchant selling branches without general branch/product APIs', async () => {
    request.mockResolvedValue(sellingBranches);
    render(<MerchantSalesBranches organizationId={scope.organizationId} />);
    const link = await screen.findByRole('link', {
      name: 'View own sales in Current Makati',
    });
    expect(link).toHaveAttribute(
      'href',
      `/app/organizations/${scope.organizationId}/branches/${scope.branchId}/sales`,
    );
    expect(request).toHaveBeenCalledExactlyOnceWith(
      `/organizations/${scope.organizationId}/sales/branches`,
    );
    expect(
      screen.queryByRole('button', { name: /print|payment|checkout/i }),
    ).not.toBeInTheDocument();
  });
  it.each(['OWNER', 'MANAGER', 'CASHIER'])(
    'keeps historical merchant lookup unavailable to %s',
    (role) => {
      workspace(role);
      render(<MerchantSalesBranches organizationId={scope.organizationId} />);
      expect(
        screen.getByRole('link', { name: 'Choose a branch' }),
      ).toBeInTheDocument();
      expect(request).not.toHaveBeenCalled();
    },
  );
  it('distinguishes empty merchant access, failed lookup and retry/access refresh', async () => {
    request
      .mockRejectedValueOnce(new ApiError(403, 'Merchant access changed'))
      .mockResolvedValueOnce([]);
    render(<MerchantSalesBranches organizationId={scope.organizationId} />);
    await screen.findByText('Merchant access changed');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText(/No sales involving your linked business yet/);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh access' }));
    expect(refreshOrganization).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('renders own-only branch sales with an explicitly labeled subtotal and no staff payment data', async () => {
    request.mockResolvedValue(ownPage);
    render(<BranchSales {...scope} />);
    await screen.findByText('Own items subtotal: PHP 850.00');
    expect(
      screen.getByRole('link', {
        name: `View own items ${ownSale.receiptCode}`,
      }),
    ).toHaveAttribute(
      'href',
      `/app/organizations/${scope.organizationId}/branches/${scope.branchId}/sales/${ownSale.id}`,
    );
    expect(screen.queryByText(/Cashier:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Total: PHP/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /print|checkout|payment/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/1 permitted sales/)).toBeInTheDocument();
  });
  it.each(['OWNER', 'MANAGER', 'CASHIER'])(
    'renders saved branch staff amounts for %s',
    async (role) => {
      workspace(role);
      request.mockResolvedValue(staffPage);
      render(<BranchSales {...scope} />);
      await screen.findByText('Total: PHP 850.00');
      expect(
        screen.getByText('Cashier: Saved Cashier · Cash'),
      ).toBeInTheDocument();
      if (role === 'CASHIER')
        expect(
          screen.getByText('Your completed sales in this assigned branch.'),
        ).toBeInTheDocument();
      expect(
        screen.getByRole('link', {
          name: `View receipt ${completedSale.receiptCode}`,
        }),
      ).toBeInTheDocument();
    },
  );
  it('validates half-open UTC dates and resets pagination when applying or clearing ranges', async () => {
    request.mockResolvedValue(ownPage);
    render(<BranchSales {...scope} />);
    await screen.findByText('Own items subtotal: PHP 850.00');
    fireEvent.change(
      screen.getByRole('textbox', { name: 'From (UTC, inclusive)' }),
      { target: { value: 'invalid' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/UTC/);
    expect(request).toHaveBeenCalledTimes(1);
    fireEvent.change(
      screen.getByRole('textbox', { name: 'From (UTC, inclusive)' }),
      { target: { value: '2026-09-13T00:00:00Z' } },
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Until (UTC, exclusive)' }),
      { target: { value: '2026-09-14T00:00:00Z' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request.mock.calls[1][0]).toContain('from=2026-09-13T00%3A00%3A00Z');
    fireEvent.click(screen.getByRole('button', { name: 'Clear dates' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    expect(request.mock.calls[2][0]).toMatch(/page=1&limit=50$/);
  });
  it('pages within bounded scoped reads and preserves active date filters', async () => {
    const items = Array.from({ length: 50 }, (_, index) => ({
      ...ownSale,
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      receiptCode: `SALE-${index}`,
    }));
    request
      .mockResolvedValueOnce({ ...ownPage, items, total: 51, totalPages: 2 })
      .mockResolvedValueOnce({ ...ownPage, page: 2, total: 51, totalPages: 2 });
    render(<BranchSales {...scope} />);
    await screen.findByRole('link', { name: 'View own items SALE-0' });
    expect(
      screen.getByRole('button', { name: 'Previous page' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('51 permitted sales · Page 2 of 2');
    expect(request.mock.calls[1][0]).toMatch(/page=2&limit=50$/);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Previous page' }),
    ).not.toBeDisabled();
  });
  it('removes stale own-sales on refresh denial and retries reads only', async () => {
    request
      .mockResolvedValueOnce(ownPage)
      .mockRejectedValueOnce(new ApiError(404, 'Sale access unavailable'))
      .mockResolvedValueOnce({
        ...ownPage,
        items: [],
        total: 0,
        totalPages: 0,
      });
    render(<BranchSales {...scope} />);
    await screen.findByText('Own items subtotal: PHP 850.00');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh sales' }));
    await screen.findByText('Sale access unavailable');
    expect(
      screen.queryByText('Own items subtotal: PHP 850.00'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText(
      /No sales involving your currently linked business/,
    );
    expect(request.mock.calls.every((call) => call.length === 1)).toBe(true);
  });
  it('shows only own historical items on merchant detail without receipt printing', async () => {
    request.mockResolvedValue(ownSale);
    render(<SaleDetail {...scope} saleId={ownSale.id} />);
    await screen.findByText(product.name);
    expect(
      screen.getByText('Own items subtotal: PHP 850.00'),
    ).toBeInTheDocument();
    expect(screen.getByText(/not a full customer receipt/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Saved Store|Saved Cashier|150.00|1000.00/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /print|checkout|payment/i }),
    ).not.toBeInTheDocument();
    expect(document.getElementById('pos-receipt-print-root')).toBeNull();
  });
  it.each(['OWNER', 'MANAGER', 'CASHIER'])(
    'prints persisted detail for %s with no checkout writes',
    async (role) => {
      workspace(role);
      request.mockResolvedValue(completedSale);
      const print = vi.spyOn(window, 'print').mockImplementation(() => {});
      render(<SaleDetail {...scope} saleId={completedSale.id} />);
      const button = await screen.findByRole('button', {
        name: 'Print internal receipt',
      });
      fireEvent.click(button);
      fireEvent.click(screen.getByRole('button', { name: 'Refresh sale' }));
      await screen.findByRole('button', { name: 'Print internal receipt' });
      expect(print).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledTimes(2);
      expect(request.mock.calls.every((call) => call.length === 1)).toBe(true);
    },
  );
  it('rejects a stale-role full receipt instead of exposing it to the merchant UI', async () => {
    request.mockResolvedValue(completedSale);
    render(<SaleDetail {...scope} saleId={completedSale.id} />);
    await screen.findByRole('alert');
    expect(
      screen.queryByRole('button', { name: 'Print internal receipt' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Saved Store')).not.toBeInTheDocument();
  });
  it('ignores old detail responses across branch/sale/role scope changes', async () => {
    let resolve!: (value: unknown) => void;
    workspace('OWNER');
    request
      .mockReturnValueOnce(
        new Promise((done) => {
          resolve = done;
        }),
      )
      .mockResolvedValueOnce(ownSale);
    const view = render(<SaleDetail {...scope} saleId={completedSale.id} />);
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    workspace('MERCHANT');
    view.rerender(<SaleDetail {...scope} saleId={ownSale.id} />);
    await screen.findByText('Own items subtotal: PHP 850.00');
    await act(async () => {
      resolve(completedSale);
    });
    expect(screen.queryByText('Saved Store')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Print internal receipt' }),
    ).not.toBeInTheDocument();
  });
  it('clears previous detail on a guessed/foreign/revoked read failure', async () => {
    workspace('CASHIER');
    request
      .mockResolvedValueOnce(completedSale)
      .mockRejectedValueOnce(new ApiError(404, 'Sale not found'));
    render(<SaleDetail {...scope} saleId={completedSale.id} />);
    await screen.findByRole('button', { name: 'Print internal receipt' });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh sale' }));
    await screen.findByText('Sale not found');
    expect(
      screen.queryByRole('button', { name: 'Print internal receipt' }),
    ).not.toBeInTheDocument();
    expect(document.getElementById('pos-receipt-print-root')).toBeNull();
  });
});
