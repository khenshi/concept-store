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
    fireEvent.click(screen.getByRole('checkbox'));
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
      await screen.findByText(/0 remaining · 1 returned · 0 restocked/);
      expect(
        screen.getByRole('button', { name: 'Return items' }),
      ).toBeDisabled();
      fireEvent.click(
        screen.getByRole('button', {
          name: `View refund ${staffRefund.refundCode}`,
        }),
      );
      const dialog = await screen.findByRole('dialog');
      await within(dialog).findByText(`Reason: ${command.reason}`);
      expect(
        within(dialog).getByText('Actual refund method: CASH (manual)'),
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
    await screen.findByText('Own returned items subtotal: PHP 850.00');
    expect(
      screen.queryByRole('button', { name: 'Return items' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: `View refund ${merchantRefund.refundCode}`,
      }),
    );
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Own returned items subtotal: PHP 850.00');
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
    const items = Array.from({ length: 10 }, (_, index) => ({
      ...staffRefund,
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      refundCode: `REFUND-${index}`,
    }));
    request
      .mockResolvedValueOnce({ ...refundPage, items, total: 11, totalPages: 2 })
      .mockRejectedValueOnce(new Error('Network'))
      .mockResolvedValueOnce({
        ...refundPage,
        page: 2,
        total: 11,
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
    await screen.findByText('11 refunds · Page 1 of 2');
    fireEvent.click(screen.getByRole('button', { name: 'Next refunds' }));
    await screen.findByText(/Retry this read; no refund will be sent again/);
    expect(screen.queryByText('REFUND-0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('11 refunds · Page 2 of 2');
    expect(
      screen.getByText(/0 remaining · 1 returned · 0 restocked/),
    ).toBeInTheDocument();
    expect(request.mock.calls[2][0]).toContain('?page=2&limit=10');
    expect(request.mock.calls.every((call) => call.length === 1)).toBe(true);
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
    await screen.findByText(/0 remaining · 1 returned · 0 restocked/);
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
    expect(
      screen.getByRole('button', { name: 'Print internal receipt' }),
    ).toBeInTheDocument();
    rejected = true;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh refunds' }));
    await screen.findByText('Refund access revoked');
    expect(screen.queryByText('Saved Store')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Print internal receipt' }),
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
    await screen.findByText('Own returned items subtotal: PHP 850.00');
    await act(async () => {
      resolve(refundPage);
    });
    expect(screen.queryByText(/^Refund: PHP/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Return items' }),
    ).not.toBeInTheDocument();
  });
});
