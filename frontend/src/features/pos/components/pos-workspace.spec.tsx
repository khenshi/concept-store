import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { SaleDetail } from '@/features/sales/components/sale-detail';
import { staffPage } from '@/features/sales/model/sales.test-fixtures';
import {
  getPosBranch,
  listPosBranches,
  lookupPosCode,
  searchPosProducts,
} from '../api/pos-api';
import { completeCheckout } from '../api/checkout-api';
import {
  scope,
  product,
  secondProduct,
  completedSale,
} from '../model/pos.test-fixtures';
import { allowPosNavigation } from '../model/pos-navigation';
import { setCheckoutAttempt } from '../model/checkout-attempt';
import { PosWorkspace } from './pos-workspace';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
vi.mock('../api/pos-api', () => ({
  getPosBranch: vi.fn(),
  listPosBranches: vi.fn(),
  lookupPosCode: vi.fn(),
  searchPosProducts: vi.fn(),
}));
vi.mock('../api/checkout-api', () => ({ completeCheckout: vi.fn() }));

describe('Persistent route-backed POS workspace', () => {
  it('preserves the cart but blocks payment after a failed return catalog read until read retry succeeds', async () => {
    const view = render(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await addProduct();
    vi.mocked(usePathname).mockReturnValue(`${base}/sales`);
    view.rerender(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await screen.findByRole('link', {
      name: `View receipt ${completedSale.receiptCode}`,
    });
    vi.mocked(searchPosProducts).mockRejectedValueOnce(new Error('offline'));
    vi.mocked(usePathname).mockReturnValue(base);
    view.rerender(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await screen.findByRole('alert');
    expect(
      screen.getByRole('textbox', { name: `Quantity for ${product.name}` }),
    ).toHaveValue('1');
    expect(
      screen.getByRole('button', { name: 'Review payment' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await readyCart();
    expect(
      screen.getByRole('button', { name: 'Review payment' }),
    ).toBeEnabled();
    expect(completeCheckout).not.toHaveBeenCalled();
  });
  it('does not print a hidden completion receipt alongside a saved receipt', async () => {
    vi.mocked(completeCheckout).mockResolvedValue(completedSale);
    const view = render(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await addProduct();
    fireEvent.click(screen.getByRole('button', { name: 'Review payment' }));
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Cash tender (PHP)' }),
      { target: { value: '1000.00' } },
    );
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
    await screen.findByRole('link', { name: 'Open saved receipt' });
    expect(document.querySelectorAll('#pos-receipt-print-root')).toHaveLength(
      1,
    );
    request.mockResolvedValue(completedSale);
    vi.mocked(usePathname).mockReturnValue(`${base}/sales/${completedSale.id}`);
    view.rerender(
      <PosWorkspace {...scope}>
        <SaleDetail {...scope} saleId={completedSale.id} embedded />
      </PosWorkspace>,
    );
    await screen.findByRole('button', { name: 'Print internal receipt' });
    expect(document.querySelectorAll('#pos-receipt-print-root')).toHaveLength(
      1,
    );
    expect(completeCheckout).toHaveBeenCalledOnce();
  });
  it('preserves a manual GCash reference without collecting payment on tab navigation', async () => {
    const view = render(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await addProduct();
    fireEvent.click(screen.getByRole('button', { name: 'Review payment' }));
    fireEvent.click(screen.getByRole('radio', { name: 'GCash (manual)' }));
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Payment reference' }),
      { target: { value: 'GCASH-REFERENCE' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Return to cart' }));
    vi.mocked(usePathname).mockReturnValue(`${base}/sales`);
    view.rerender(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await screen.findByRole('link', {
      name: `View receipt ${completedSale.receiptCode}`,
    });
    vi.mocked(usePathname).mockReturnValue(base);
    view.rerender(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await readyCart();
    fireEvent.click(screen.getByRole('button', { name: 'Review payment' }));
    expect(screen.getByRole('radio', { name: 'GCash (manual)' })).toBeChecked();
    expect(
      screen.getByRole('textbox', { name: 'Payment reference' }),
    ).toHaveValue('GCASH-REFERENCE');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(completeCheckout).not.toHaveBeenCalled();
  });
  it('retains history pagination between Cart and History', async () => {
    vi.mocked(usePathname).mockReturnValue(`${base}/sales`);
    const page1 = {
      ...staffPage,
      items: Array.from({ length: 50 }, (_, index) => ({
        ...completedSale,
        id: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
      })),
      total: 51,
      totalPages: 2,
    };
    request.mockResolvedValue(page1);
    const view = render(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await screen.findByText('51 permitted sales · Page 1 of 2');
    request.mockResolvedValue({
      ...staffPage,
      page: 2,
      total: 51,
      totalPages: 2,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('51 permitted sales · Page 2 of 2');
    vi.mocked(usePathname).mockReturnValue(base);
    view.rerender(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await readyCart();
    vi.mocked(usePathname).mockReturnValue(`${base}/sales`);
    view.rerender(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await screen.findByText('51 permitted sales · Page 2 of 2');
    expect(request).toHaveBeenLastCalledWith(expect.stringContaining('page=2'));
  });
  it('locks History during a pending checkout and retains the original request', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(completeCheckout).mockReturnValue(new Promise(() => {}));
    render(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await addProduct();
    fireEvent.click(screen.getByRole('button', { name: 'Review payment' }));
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Cash tender (PHP)' }),
      { target: { value: '1000.00' } },
    );
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
    await screen.findByRole('button', { name: 'Completing checkout…' });
    expect(allowPosNavigation(`${base}/sales`)).toBe(false);
    expect(screen.getByRole('link', { name: 'Sales History' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(completeCheckout).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
  });
  const base = `/app/organizations/${scope.organizationId}/branches/${scope.branchId}/pos`;
  const request = vi.fn();
  const workspace = (role = 'OWNER', userId = 'actor') => {
    vi.mocked(useAuth).mockReturnValue({
      request,
      user: { id: userId },
    } as never);
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { id: scope.organizationId, role },
      organizationStatus: 'ready',
      refreshOrganization: vi.fn(),
    } as never);
  };
  beforeEach(() => {
    vi.resetAllMocks();
    workspace();
    vi.mocked(usePathname).mockReturnValue(base);
    vi.mocked(getPosBranch).mockImplementation(async (_request, selected) => ({
      id: selected.branchId,
      name: 'Makati',
      code: 'MKT',
    }));
    vi.mocked(listPosBranches).mockResolvedValue([
      { id: scope.branchId, name: 'Makati', code: 'MKT' },
      { id: secondProduct.branchInventoryId, name: 'BGC', code: 'BGC' },
    ]);
    vi.mocked(searchPosProducts).mockResolvedValue([product]);
    vi.mocked(lookupPosCode).mockResolvedValue([product]);
    request.mockResolvedValue(staffPage);
  });
  afterEach(() => {
    setCheckoutAttempt(`${scope.organizationId}:actor`, null);
    vi.restoreAllMocks();
  });
  const readyCart = async () => {
    const add = await screen.findByRole('button', {
      name: `Add ${product.name}`,
    });
    await waitFor(() => expect(add).toBeEnabled());
    return add;
  };
  const addProduct = async () => {
    fireEvent.click(await readyCart());
    await screen.findByRole('textbox', {
      name: `Quantity for ${product.name}`,
    });
  };
  it('preserves cart and cash draft, refreshes authorized reads, and never checks out on tab changes', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const view = render(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await addProduct();
    fireEvent.click(screen.getByRole('button', { name: 'Review payment' }));
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Cash tender (PHP)' }),
      { target: { value: '1000.00' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Return to cart' }));
    expect(allowPosNavigation(`${base}/sales`)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    vi.mocked(usePathname).mockReturnValue(`${base}/sales`);
    view.rerender(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    expect(
      await screen.findByRole('link', {
        name: `View receipt ${completedSale.receiptCode}`,
      }),
    ).toHaveAttribute('href', `${base}/sales/${completedSale.id}`);
    expect(screen.getByRole('link', { name: 'Sales History' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.queryByRole('textbox', { name: `Quantity for ${product.name}` }),
    ).not.toBeInTheDocument();
    vi.mocked(usePathname).mockReturnValue(base);
    view.rerender(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    expect(
      screen.getByRole('button', { name: 'Review payment' }),
    ).toBeDisabled();
    await readyCart();
    expect(
      screen.getByRole('textbox', { name: `Quantity for ${product.name}` }),
    ).toHaveValue('1');
    fireEvent.click(screen.getByRole('button', { name: 'Review payment' }));
    expect(
      screen.getByRole('textbox', { name: 'Cash tender (PHP)' }),
    ).toHaveValue('1000.00');
    expect(getPosBranch).toHaveBeenCalledTimes(3);
    expect(
      vi.mocked(searchPosProducts).mock.calls.length,
    ).toBeGreaterThanOrEqual(2);
    expect(completeCheckout).not.toHaveBeenCalled();
  });
  it('keeps history date filters through receipt detail and Cart and uses a single receipt print surface', async () => {
    vi.mocked(usePathname).mockReturnValue(`${base}/sales`);
    const view = render(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await screen.findByRole('button', { name: 'Apply dates' });
    const from = '2026-09-13T00:00:00Z';
    fireEvent.change(
      screen.getByRole('textbox', { name: 'From (UTC, inclusive)' }),
      { target: { value: from } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
    await screen.findByRole('link', {
      name: `View receipt ${completedSale.receiptCode}`,
    });
    request.mockResolvedValue(completedSale);
    vi.mocked(usePathname).mockReturnValue(`${base}/sales/${completedSale.id}`);
    view.rerender(
      <PosWorkspace {...scope}>
        <SaleDetail {...scope} saleId={completedSale.id} embedded />
      </PosWorkspace>,
    );
    await screen.findByRole('button', { name: 'Print internal receipt' });
    expect(document.querySelectorAll('#pos-receipt-print-root')).toHaveLength(
      1,
    );
    expect(
      screen.getByRole('link', { name: 'Return to sales history' }),
    ).toHaveAttribute('href', `${base}/sales`);
    expect(screen.getByRole('link', { name: 'Sales History' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    request.mockResolvedValue(staffPage);
    vi.mocked(usePathname).mockReturnValue(base);
    view.rerender(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await readyCart();
    vi.mocked(usePathname).mockReturnValue(`${base}/sales`);
    view.rerender(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await screen.findByRole('link', {
      name: `View receipt ${completedSale.receiptCode}`,
    });
    expect(
      screen.getByRole('textbox', { name: 'From (UTC, inclusive)' }),
    ).toHaveValue(from);
    expect(request).toHaveBeenLastCalledWith(
      expect.stringContaining(`from=${encodeURIComponent(from)}`),
    );
    expect(document.querySelectorAll('#pos-receipt-print-root')).toHaveLength(
      0,
    );
    expect(completeCheckout).not.toHaveBeenCalled();
  });
  it.each(['user', 'role', 'branch'])(
    'clears an editable draft after %s scope changes',
    async (change) => {
      const view = render(<PosWorkspace {...scope}>{null}</PosWorkspace>);
      await addProduct();
      if (change === 'user') workspace('OWNER', 'other-user');
      if (change === 'role') workspace('CASHIER');
      const next =
        change === 'branch'
          ? { ...scope, branchId: secondProduct.branchInventoryId }
          : scope;
      vi.mocked(usePathname).mockReturnValue(
        `/app/organizations/${next.organizationId}/branches/${next.branchId}/pos`,
      );
      view.rerender(<PosWorkspace {...next}>{null}</PosWorkspace>);
      await readyCart();
      expect(
        screen.queryByRole('textbox', { name: `Quantity for ${product.name}` }),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText('Estimated total')).toHaveTextContent(
        '0.00',
      );
    },
  );
  it('clears the retained cart when branch access is revoked before returning to Cart', async () => {
    const view = render(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await addProduct();
    vi.mocked(usePathname).mockReturnValue(`${base}/sales`);
    view.rerender(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await screen.findByRole('link', {
      name: `View receipt ${completedSale.receiptCode}`,
    });
    vi.mocked(getPosBranch).mockRejectedValueOnce(
      new ApiError(404, 'Unavailable'),
    );
    vi.mocked(usePathname).mockReturnValue(base);
    view.rerender(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'POS access is unavailable',
    );
    expect(
      screen.queryByRole('textbox', { name: `Quantity for ${product.name}` }),
    ).not.toBeInTheDocument();
  });
  it('keeps an uncertain checkout visible instead of allowing a history route to conceal recovery', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(completeCheckout).mockRejectedValue(new Error('network'));
    const view = render(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    await addProduct();
    fireEvent.click(screen.getByRole('button', { name: 'Review payment' }));
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Cash tender (PHP)' }),
      { target: { value: '1000.00' } },
    );
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
    await screen.findByRole('button', { name: 'Retry same checkout' });
    expect(allowPosNavigation(`${base}/sales`)).toBe(false);
    expect(alert).toHaveBeenCalled();
    vi.mocked(usePathname).mockReturnValue(`${base}/sales`);
    view.rerender(<PosWorkspace {...scope}>{null}</PosWorkspace>);
    expect(
      screen.getByRole('button', { name: 'Retry same checkout' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {
        name: `View receipt ${completedSale.receiptCode}`,
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cart' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(request).not.toHaveBeenCalled();
    expect(completeCheckout).toHaveBeenCalledOnce();
  });
});
