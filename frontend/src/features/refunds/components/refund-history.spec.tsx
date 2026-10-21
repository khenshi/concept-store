import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { completedSale } from '@/features/pos/model/pos.test-fixtures';
import { ownSale } from '@/features/sales/model/sales.test-fixtures';
import { SaleDetail } from '@/features/sales/components/sale-detail';
import { allowPosNavigation } from '@/features/pos/model/pos-navigation';
import {
  command,
  emptyPage,
  refundPage,
  ownRefundPage,
  refundScope,
  staffRefund,
  merchantRefund,
} from '../model/refund.test-fixtures';
import {
  getRefundAttempt,
  refundAttemptKey,
  setRefundAttempt,
} from '../model/refund-attempt';
import { RefundHistory } from './refund-history';
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
describe('saved refund history and role privacy', () => {
  const request = vi.fn();
  const denied = vi.fn();
  const key = refundAttemptKey(refundScope.organizationId, 'actor');
  function fill() {
    fireEvent.change(screen.getByRole('textbox', { name: /Return units/ }), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Refund reason' }), {
      target: { value: command.reason },
    });
  }
  function expectReturnedQuantities() {
    const list = screen.getByRole('list', {
      name: 'Returnable quantities',
    });
    const row = within(list).getAllByRole('listitem')[1];
    expect(row.children[1]).toHaveTextContent('0');
    expect(row.children[2]).toHaveTextContent('1');
    expect(row.children[3]).toHaveTextContent('0');
  }
  beforeEach(() => {
    vi.resetAllMocks();
    setRefundAttempt(key, null);
    vi.mocked(useAuth).mockReturnValue({
      request,
      user: { id: 'actor' },
    } as never);
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { id: refundScope.organizationId, role: 'OWNER' },
      organizationStatus: 'ready',
      refreshOrganization: vi.fn(),
    } as never);
  });
  afterEach(() => {
    setRefundAttempt(key, null);
    vi.restoreAllMocks();
  });
  it.each(['OWNER', 'MANAGER'] as const)(
    'shows immutable staff refund details and all-page remaining for %s',
    async (role) => {
      request.mockImplementation(async (path: string) =>
        path.includes('?') ? refundPage : staffRefund,
      );
      render(
        <RefundHistory
          scope={refundScope}
          sale={completedSale}
          role={role}
          onDenied={denied}
        />,
      );
      const remainingList = await screen.findByRole('list', {
        name: 'Returnable quantities',
      });
      const refundHeader = screen
        .getByRole('heading', { name: 'Return refunds' })
        .closest('header');
      expect(refundHeader).toHaveClass(
        'border-b',
        'border-hairline',
        'px-5',
        'sm:px-6',
      );
      const header = within(remainingList).getByText('Product').parentElement;
      expect(header).not.toBeNull();
      expect(
        within(header!).getByText('Available to return'),
      ).toBeInTheDocument();
      expect(within(header!).getByText('Returned')).toBeInTheDocument();
      expect(within(header!).getByText('Restocked')).toBeInTheDocument();
      expect(screen.getByText(completedSale.items[0].productName)).toHaveClass(
        'font-semibold',
      );
      const recordedHeader = screen.getByText('Refund').closest('li');
      expect(recordedHeader).not.toBeNull();
      expect(within(recordedHeader!).getByText('Date')).toBeInTheDocument();
      expect(within(recordedHeader!).getByText('Amount')).toBeInTheDocument();
      expect(within(recordedHeader!).getByText('Action')).toBeInTheDocument();
      const viewButton = screen.getByRole('button', { name: 'View' });
      expect(viewButton).toHaveClass('ui-button-quiet');
      expectReturnedQuantities();
      expect(
        screen.getByRole('button', { name: 'Return items' }),
      ).toBeDisabled();
      fireEvent.click(viewButton);
      const dialog = await screen.findByRole('dialog');
      await within(dialog).findByText(command.reason);
      expect(
        within(dialog).getByText('Actual refund method'),
      ).toBeInTheDocument();
      expect(within(dialog).getByText('Date')).toBeInTheDocument();
      expect(within(dialog).getByText('Status')).toBeInTheDocument();
      expect(
        within(dialog).getByText('Completed', { exact: true }),
      ).toHaveClass('text-success-ink');
      expect(within(dialog).getByText('CASH')).toBeInTheDocument();
      expect(within(dialog).getByText('Refund total')).toBeInTheDocument();
      expect(within(dialog).getByText('Returned items')).toBeInTheDocument();
      expect(within(dialog).getByRole('table')).toBeInTheDocument();
      for (const label of [
        'Product',
        'Returned',
        'Restocked',
        'Unit price',
        'Line total',
      ])
        expect(
          within(dialog).getByRole('columnheader', { name: label }),
        ).toBeInTheDocument();
      expect(
        within(dialog).queryByRole('button', { name: /print|edit|delete/i }),
      ).not.toBeInTheDocument();
      expect(request.mock.calls.every((call) => call.length === 1)).toBe(true);
    },
  );
  it('shows merchant own-only refund lines and subtotal without staff, actor, payment or print exposure', async () => {
    request.mockImplementation(async (path: string) =>
      path.includes('?') ? ownRefundPage : merchantRefund,
    );
    render(
      <RefundHistory
        scope={refundScope}
        sale={ownSale}
        role="MERCHANT"
        onDenied={denied}
      />,
    );
    await screen.findByText('PHP 850.00');
    expect(
      screen.queryByRole('button', { name: 'Return items' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Own returned items subtotal');
    expect(within(dialog).getByText(/Saved Makati/)).toBeInTheDocument();
    expect(
      within(dialog).queryByText(
        /CASH|Reason:|Reference:|Damaged|Saved Cashier/,
      ),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', {
        name: /print|record|refund money/i,
      }),
    ).not.toBeInTheDocument();
    expect(document.getElementById('pos-receipt-print-root')).toBeNull();
  });
  it('mounts no refund reads or controls for cashiers', () => {
    const view = render(
      <RefundHistory
        scope={refundScope}
        sale={completedSale}
        role="CASHIER"
        onDenied={denied}
      />,
    );
    expect(view.container).toBeEmptyDOMElement();
    expect(request).not.toHaveBeenCalled();
  });
  it('paginates independently of cumulative remaining and retries reads only', async () => {
    const items = Array.from({ length: 15 }, (_, index) => ({
      ...staffRefund,
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      refundCode: `REFUND-${index}`,
    }));
    request
      .mockResolvedValueOnce({ ...refundPage, items, total: 16, totalPages: 2 })
      .mockRejectedValueOnce(new Error('Network'))
      .mockResolvedValueOnce({
        ...refundPage,
        page: 2,
        total: 16,
        totalPages: 2,
      });
    render(
      <RefundHistory
        scope={refundScope}
        sale={completedSale}
        role="OWNER"
        onDenied={denied}
      />,
    );
    await screen.findByText('16 refunds');
    expect(screen.getByText('1/2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next refunds' }));
    await screen.findByText(/Retry this read; no refund will be sent again/);
    expect(screen.queryByText('REFUND-0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('2/2');
    expectReturnedQuantities();
    expect(request.mock.calls[2][0]).toContain('?page=2&limit=15');
    expect(request.mock.calls.every((call) => call.length === 1)).toBe(true);
  });
  it('shows a centered empty state when no refunds are recorded', async () => {
    request.mockResolvedValue(emptyPage);
    render(
      <RefundHistory
        scope={refundScope}
        sale={completedSale}
        role="OWNER"
        onDenied={denied}
      />,
    );
    const emptyHeading = await screen.findByText('No refunds recorded yet.');
    const emptyState = emptyHeading.parentElement!;
    expect(emptyState).toHaveTextContent('No refunds recorded yet.');
    expect(emptyState).toHaveTextContent(
      'Completed refunds for this sale will appear here.',
    );
    expect(emptyState).toHaveClass('border', 'text-center');
  });
  it('confirmed write closes dialog; failed history refresh can only retry GET, not resend POST', async () => {
    let written = false;
    let readRecovered = false;
    request.mockImplementation(async (_path: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        written = true;
        return staffRefund;
      }
      if (written && !readRecovered) throw new Error('Read failed');
      return written ? refundPage : emptyPage;
    });
    render(
      <RefundHistory
        scope={refundScope}
        sale={completedSale}
        role="OWNER"
        onDenied={denied}
      />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Return items' }),
    );
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Record refund' }));
    await screen.findByText(/Retry this read; no refund will be sent again/);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getRefundAttempt(key)?.state).toBe('completed');
    readRecovered = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('list', {
      name: 'Returnable quantities',
    });
    expectReturnedQuantities();
    await waitFor(() => expect(getRefundAttempt(key)).toBeNull());
    expect(
      request.mock.calls.filter((call) => call[1]?.method === 'POST'),
    ).toHaveLength(1);
  });
  it('remounts unknown recovery without an automatic POST and freezes another sale', async () => {
    setRefundAttempt(key, { scope: refundScope, command, state: 'unknown' });
    request.mockResolvedValue(emptyPage);
    const view = render(
      <RefundHistory
        scope={refundScope}
        sale={completedSale}
        role="OWNER"
        onDenied={denied}
      />,
    );
    await screen.findByRole('button', { name: 'Retry same refund' });
    expect(request.mock.calls.every((call) => call.length === 1)).toBe(true);
    view.unmount();
    const anotherSale = { ...completedSale, id: staffRefund.id };
    render(
      <RefundHistory
        scope={{ ...refundScope, saleId: anotherSale.id }}
        sale={anotherSale}
        role="OWNER"
        onDenied={denied}
      />,
    );
    await screen.findByRole('link', { name: 'Resolve the original refund' });
    expect(screen.getByRole('button', { name: 'Return items' })).toBeDisabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('clears original sale as well as refund details on denied refresh, preserving unknown navigation lock', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    let rejected = false;
    request.mockImplementation(async (path: string) => {
      if (!path.includes('/refunds')) return completedSale;
      if (rejected) throw new ApiError(403, 'Refund access revoked');
      return emptyPage;
    });
    render(
      <SaleDetail
        organizationId={refundScope.organizationId}
        branchId={refundScope.branchId}
        saleId={refundScope.saleId}
      />,
    );
    await screen.findByRole('button', { name: 'Return items' });
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
    rejected = true;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh refunds' }));
    await screen.findByText('Refund access revoked');
    expect(screen.queryByText('Saved Store')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Print' }),
    ).not.toBeInTheDocument();
    act(() =>
      setRefundAttempt(key, { scope: refundScope, command, state: 'unknown' }),
    );
    expect(allowPosNavigation('/app/reports')).toBe(false);
  });
  it('ignores late privileged reads after merchant scope remount', async () => {
    let resolve!: (value: unknown) => void;
    request
      .mockReturnValueOnce(
        new Promise((done) => {
          resolve = done;
        }),
      )
      .mockResolvedValueOnce(ownRefundPage);
    const view = render(
      <RefundHistory
        key="staff"
        scope={refundScope}
        sale={completedSale}
        role="OWNER"
        onDenied={denied}
      />,
    );
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    view.rerender(
      <RefundHistory
        key="merchant"
        scope={refundScope}
        sale={ownSale}
        role="MERCHANT"
        onDenied={denied}
      />,
    );
    await screen.findByText('PHP 850.00');
    await act(async () => {
      resolve(refundPage);
    });
    expect(screen.queryByText(/^Refund: PHP/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Return items' }),
    ).not.toBeInTheDocument();
  });
});
