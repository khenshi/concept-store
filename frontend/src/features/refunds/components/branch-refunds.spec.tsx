import { paymentAccounts } from '@/features/pos/model/payment-account.test-fixtures';
vi.mock('@/features/pos/model/use-branch-payment-accounts', () => ({
  useBranchPaymentAccounts: () => ({
    accounts: paymentAccounts,
    refresh: vi.fn(),
  }),
  paymentAccountHistoryLabel: (account: { name: string }) => account.name,
}));
import { cashSnapshot } from '@/features/pos/model/payment-account.test-fixtures';
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
import { completedSale, scope } from '@/features/pos/model/pos.test-fixtures';
import { staffPage } from '@/features/sales/model/sales.test-fixtures';
import {
  command,
  emptyPage,
  refundScope,
  staffRefund,
} from '../model/refund.test-fixtures';
import { refundAttemptKey, setRefundAttempt } from '../model/refund-attempt';
import { allowPosNavigation } from '@/features/pos/model/pos-navigation';
import { BranchRefunds } from './branch-refunds';

const navigation = vi.hoisted(() => ({ params: '', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(navigation.params),
  useRouter: () => ({ push: navigation.push }),
}));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
const branchPage = {
  scope: 'STAFF',
  ...scope,
  page: 1,
  limit: 15,
  total: 1,
  totalPages: 1,
  items: [
    {
      id: staffRefund.id,
      saleId: completedSale.id,
      receiptCode: completedSale.receiptCode,
      refundCode: staffRefund.refundCode,
      completedAt: staffRefund.completedAt,
      ...cashSnapshot,
      total: staffRefund.total,
    },
  ],
};
const base = `/app/organizations/${scope.organizationId}/branches/${scope.branchId}/pos/refunds`;
describe('POS branch refund history', () => {
  const request = vi.fn();
  const key = refundAttemptKey(scope.organizationId, 'actor');
  beforeEach(() => {
    vi.resetAllMocks();
    navigation.params = '';
    setRefundAttempt(key, null);
    vi.mocked(useAuth).mockReturnValue({
      request,
      user: { id: 'actor' },
    } as never);
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { id: scope.organizationId, role: 'OWNER' },
    } as never);
    request.mockImplementation(async (path: string) => {
      if (path.includes('/sales?')) return staffPage;
      if (path.includes(`/sales/${completedSale.id}/refunds?`))
        return emptyPage;
      if (path.endsWith(`/refunds/${staffRefund.id}`)) return staffRefund;
      if (path.endsWith(`/sales/${completedSale.id}`)) return completedSale;
      return branchPage;
    });
  });
  afterEach(() => {
    setRefundAttempt(key, null);
    vi.restoreAllMocks();
  });
  it.each(['MERCHANT', 'CASHIER'])(
    'denies %s without mounting reads',
    (role) => {
      vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
        organization: { id: scope.organizationId, role },
      } as never);
      render(<BranchRefunds {...scope} />);
      expect(screen.getByRole('alert')).toHaveTextContent('cannot access');
      expect(request).not.toHaveBeenCalled();
    },
  );
  it('shows branch summaries, pagination and routes detail while retaining filters', async () => {
    navigation.params = 'method=CASH&q=REF';
    render(<BranchRefunds {...scope} />);
    expect(await screen.findByText(staffRefund.refundCode)).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Branch refund pagination' }),
    ).toHaveTextContent('1 refunds');
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    const href = navigation.push.mock.calls[0][0];
    const params = new URL(href, 'http://localhost').searchParams;
    expect(params.get('method')).toBe('CASH');
    expect(params.get('q')).toBe('REF');
    expect(params.get('sale')).toBe(completedSale.id);
    expect(params.get('refund')).toBe(staffRefund.id);
    expect(request.mock.calls.every((call) => call.length === 1)).toBe(true);
  });
  it('starts selection directly, then loads fresh quantities and the existing return form', async () => {
    const view = render(<BranchRefunds {...scope} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Find sale to refund' }),
    );
    expect(navigation.push).toHaveBeenCalledWith(`${base}?select=1`, {
      scroll: false,
    });
    navigation.params = 'select=1';
    view.rerender(<BranchRefunds {...scope} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Select sale' }));
    navigation.params = `select=1&sale=${completedSale.id}`;
    view.rerender(<BranchRefunds {...scope} />);
    expect(
      await screen.findByRole('dialog', {
        name: 'Return items and record refund',
      }),
    ).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining(
        `/sales/${completedSale.id}/refunds?page=1&limit=15`,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(navigation.push).toHaveBeenLastCalledWith(`${base}?select=1`, {
      scroll: false,
    });
    expect(request.mock.calls.every((call) => call.length === 1)).toBe(true);
  });
  it('resolves and validates original-sale snapshots before displaying refund detail', async () => {
    navigation.params = `sale=${completedSale.id}&refund=${staffRefund.id}`;
    render(<BranchRefunds {...scope} />);
    expect(await screen.findByText(staffRefund.reason)).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'Refund details' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Return items' })).toBeNull();
    expect(
      screen.getByRole('link', { name: 'View original sale' }),
    ).toHaveAttribute(
      'href',
      base.replace('/refunds', `/sales/${completedSale.id}`),
    );
  });
  it('does not open a return form for an exhausted sale', async () => {
    navigation.params = `select=1&sale=${completedSale.id}`;
    const read = request.getMockImplementation()!;
    request.mockImplementation(async (path: string) =>
      path.includes(`/sales/${completedSale.id}/refunds?`)
        ? {
            ...emptyPage,
            remainingItems: emptyPage.remainingItems.map((item) => ({
              ...item,
              remainingQuantity: 0,
              returnedQuantity: item.soldQuantity,
            })),
          }
        : read(path),
    );
    render(<BranchRefunds {...scope} />);
    expect(
      await screen.findByText('No items available to return.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('records through the existing command and preserves history filters on completion', async () => {
    navigation.params = `method=CASH&q=REF&select=1&sale=${completedSale.id}`;
    const read = request.getMockImplementation()!;
    request.mockImplementation(async (...args: unknown[]) =>
      args[1] ? staffRefund : read(...args),
    );
    render(<BranchRefunds {...scope} />);
    await screen.findByRole('dialog', {
      name: 'Return items and record refund',
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Return units/ }), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Refund reason' }), {
      target: { value: command.reason },
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Record refund' }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Record refund' }));
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith(
        `${base}?method=CASH&q=REF`,
        { scroll: false },
      ),
    );
    expect(
      await screen.findByText(
        `Refund ${staffRefund.refundCode} recorded. Current history filters are preserved.`,
      ),
    ).toBeInTheDocument();
    const posts = request.mock.calls.filter((call) => call[1]);
    expect(posts).toHaveLength(1);
    expect(posts[0][1]).toMatchObject({ method: 'POST' });
  });
  it('keeps uncertain outcomes frozen and retries the identical command only on explicit retry', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    navigation.params = `select=1&sale=${completedSale.id}`;
    const read = request.getMockImplementation()!;
    let writes = 0;
    request.mockImplementation(async (...args: unknown[]) => {
      if (!args[1]) return read(...args);
      if (++writes === 1) throw new Error('network interrupted');
      return staffRefund;
    });
    render(<BranchRefunds {...scope} />);
    await screen.findByRole('dialog', {
      name: 'Return items and record refund',
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Return units/ }), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Refund reason' }), {
      target: { value: command.reason },
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Record refund' }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Record refund' }));
    await screen.findByRole('button', { name: 'Retry same refund' });
    expect(allowPosNavigation(`${base}?select=1`)).toBe(false);
    expect(
      screen.getByRole('textbox', { name: 'Refund reason' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry same refund' }));
    await waitFor(() => expect(writes).toBe(2));
    const posts = request.mock.calls.filter((call) => call[1]);
    expect(posts[1]).toEqual(posts[0]);
  });
  it('clears denied content and retries only GET reads', async () => {
    request.mockRejectedValueOnce(new ApiError(403, 'Access changed.'));
    render(<BranchRefunds {...scope} />);
    expect(await screen.findByText('Access changed.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(staffRefund.refundCode)).toBeInTheDocument();
    expect(request.mock.calls.every((call) => call.length === 1)).toBe(true);
  });
  it('retains an unresolved attempt and blocks new selection and programmatic navigation', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    setRefundAttempt(key, { scope: refundScope, command, state: 'unknown' });
    render(<BranchRefunds {...scope} />);
    expect(
      await screen.findByRole('button', { name: 'Retry same refund' }),
    ).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'Find sale to refund' }),
    ).toBeNull();
    expect(allowPosNavigation(`${base}?select=1`)).toBe(false);
    expect(
      allowPosNavigation(
        base.replace('/refunds', `/sales/${completedSale.id}`),
      ),
    ).toBe(false);
  });
  it('discards old branch results after a scope change', async () => {
    let resolve!: (value: unknown) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const view = render(<BranchRefunds {...scope} />);
    await waitFor(() => expect(request).toHaveBeenCalled());
    request.mockResolvedValue({
      ...branchPage,
      branchId: staffRefund.id,
      items: [],
      total: 0,
      totalPages: 0,
    });
    view.rerender(<BranchRefunds {...scope} branchId={staffRefund.id} />);
    await screen.findByText('No refunds recorded yet.');
    await act(async () => resolve(branchPage));
    expect(screen.queryByText(staffRefund.refundCode)).toBeNull();
  });
  it('pins a pending sale through query Back and retains completed acknowledgement reads', async () => {
    navigation.params = `select=1&sale=${completedSale.id}`;
    const view = render(<BranchRefunds {...scope} />);
    await screen.findByRole('dialog', {
      name: 'Return items and record refund',
    });
    act(() =>
      setRefundAttempt(key, { scope: refundScope, command, state: 'pending' }),
    );
    navigation.params = '';
    view.rerender(<BranchRefunds {...scope} />);
    expect(
      screen.getByRole('dialog', { name: 'Return items and record refund' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Find sale to refund' }),
    ).toBeNull();
    request.mockRejectedValueOnce(new Error('read failed'));
    act(() =>
      setRefundAttempt(key, {
        scope: refundScope,
        command,
        state: 'completed',
        refund: staffRefund,
      }),
    );
    expect(
      await screen.findByText(/Refund history could not be refreshed/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Find sale to refund' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('button', { name: 'Find sale to refund' }),
    ).toBeEnabled();
  });
});
