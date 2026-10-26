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
import { ownSale } from '@/features/sales/model/sales.test-fixtures';
import {
  staffRefund,
  merchantRefund,
} from '@/features/refunds/model/refund.test-fixtures';
import type { StaffTransactionsPage } from '../model/report.schemas';
import { TransactionsTab } from './transactions-tab';
const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
const page: StaffTransactionsPage = {
  scope: 'STAFF',
  branch: { id: scope.branchId, name: 'Makati', code: 'MKT' },
  from: '2026-09-01T00:00:00.000Z',
  until: '2026-10-01T00:00:00.000Z',
  page: 1,
  limit: 15,
  total: 1,
  totalPages: 1,
  items: [
    {
      id: staffRefund.id,
      type: 'REFUND',
      saleId: completedSale.id,
      refundId: staffRefund.id,
      reference: staffRefund.refundCode,
      completedAt: staffRefund.completedAt,
      amount: staffRefund.total,
      paymentAccountId: '77777777-7777-4777-8777-777777777777',
      paymentAccountName: 'Cash',
      paymentAccountIsCash: true,
      paymentAccountRequiresReference: false,
      actorName: 'Saved Cashier',
      merchantNames: ['Amihan Home'],
    },
  ],
};
const props = {
  ...scope,
  merchant: false,
  page,
  loading: false,
  error: null,
  filterType: 'ALL' as const,
  search: '',
  onTypeChange: vi.fn(),
  onSearchChange: vi.fn(),
  onRetry: vi.fn(),
  onPageChange: vi.fn(),
};
describe('Reports inline refund details', () => {
  const request = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      request,
      user: { id: 'actor' },
    } as never);
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { id: scope.organizationId, role: 'OWNER' },
    } as never);
    request.mockImplementation(async (path: string) =>
      path.endsWith(`/refunds/${staffRefund.id}`) ? staffRefund : completedSale,
    );
  });
  it('opens the existing details modal without navigation and preserves report filters on close', async () => {
    render(<TransactionsTab {...props} search="REFUND" filterType="REFUND" />);
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(
      screen.getByRole('dialog', { name: 'Refund details' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(staffRefund.reason)).toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.every((call) => call.length === 1)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByRole('searchbox', { name: 'Search transactions' }),
    ).toHaveValue('REFUND');
    expect(props.onPageChange).not.toHaveBeenCalled();
    expect(props.onTypeChange).not.toHaveBeenCalled();
  });
  it.each(['click', 'Enter', ' '] as const)(
    'opens refund row detail with %s',
    async (activation) => {
      render(<TransactionsTab {...props} />);
      const row = screen.getByRole('row', {
        name: `Open refund ${staffRefund.refundCode}`,
      });
      if (activation === 'click') fireEvent.click(row);
      else fireEvent.keyDown(row, { key: activation });
      expect(await screen.findByText(staffRefund.reason)).toBeInTheDocument();
      expect(navigation.push).not.toHaveBeenCalled();
    },
  );
  it('retains sale-row navigation', () => {
    const salePage: StaffTransactionsPage = {
      ...page,
      items: [{ ...page.items[0], type: 'SALE', refundId: null }],
    };
    render(<TransactionsTab {...props} page={salePage} />);
    fireEvent.click(
      screen.getByRole('row', { name: `Open sale ${staffRefund.refundCode}` }),
    );
    expect(navigation.push).toHaveBeenCalledWith(
      `/app/organizations/${scope.organizationId}/branches/${scope.branchId}/sales/${completedSale.id}`,
    );
    expect(screen.getByRole('link', { name: 'View' })).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
  it('includes the complete Transactions return URL in sale links and row navigation', () => {
    const returnTo = `/app/organizations/${scope.organizationId}/branches/${scope.branchId}/reports/transactions?preset=CUSTOM&fromDay=2026-10-01&throughDay=2026-10-21&transactionPage=3&transactionQ=RCPT%20%2B%201&transactionType=SALE`;
    const salePage: StaffTransactionsPage = {
      ...page,
      items: [{ ...page.items[0], type: 'SALE', refundId: null }],
    };
    render(<TransactionsTab {...props} page={salePage} returnTo={returnTo} />);
    const link = screen.getByRole('link', { name: 'View' });
    const href = link.getAttribute('href')!;
    expect(new URL(href, 'http://localhost').searchParams.get('returnTo')).toBe(
      returnTo,
    );
    fireEvent.keyDown(
      screen.getByRole('row', { name: `Open sale ${staffRefund.refundCode}` }),
      { key: 'Enter' },
    );
    expect(navigation.push).toHaveBeenCalledWith(href);
  });
  it('uses each aggregate row branch for sale detail and preserves the All Branches return URL', () => {
    const returnTo = `/app/organizations/${scope.organizationId}/reports/all/transactions?preset=CUSTOM&fromDay=2026-10-01&throughDay=2026-10-21&transactionPage=3`;
    const { branch: _branch, ...allPageBase } = page;
    void _branch;
    const sourceBranch = {
      id: scope.branchId,
      name: 'Makati',
      code: 'MKT',
    };
    const salePage: StaffTransactionsPage = {
      ...allPageBase,
      reportScope: 'ALL',
      branchCount: 2,
      items: [
        {
          ...page.items[0],
          type: 'SALE',
          refundId: null,
          branch: sourceBranch,
        },
      ],
    };
    render(
      <TransactionsTab
        {...props}
        branchId={null}
        allBranches
        page={salePage}
        returnTo={returnTo}
      />,
    );
    const link = screen.getByRole('link', { name: 'View' });
    const href = link.getAttribute('href')!;
    expect(href).toContain(
      `/app/organizations/${scope.organizationId}/branches/${scope.branchId}/sales/${completedSale.id}?`,
    );
    expect(new URL(href, 'http://localhost').searchParams.get('returnTo')).toBe(
      returnTo,
    );
    fireEvent.click(
      screen.getByRole('row', { name: `Open sale ${staffRefund.refundCode}` }),
    );
    expect(navigation.push).toHaveBeenCalledWith(href);
  });
  it('loads refund details through the aggregate row source branch', async () => {
    const { branch: _branch, ...allPageBase } = page;
    void _branch;
    const sourceBranch = {
      id: scope.branchId,
      name: 'Makati',
      code: 'MKT',
    };
    const allPage: StaffTransactionsPage = {
      ...allPageBase,
      reportScope: 'ALL',
      branchCount: 2,
      items: [{ ...page.items[0], branch: sourceBranch }],
    };
    render(
      <TransactionsTab {...props} branchId={null} allBranches page={allPage} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(await screen.findByText(staffRefund.reason)).toBeInTheDocument();
    expect(request.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        `/organizations/${scope.organizationId}/branches/${scope.branchId}/sales/${completedSale.id}`,
        `/organizations/${scope.organizationId}/branches/${scope.branchId}/sales/${completedSale.id}/refunds/${staffRefund.id}`,
      ]),
    );
    expect(navigation.push).not.toHaveBeenCalled();
  });
  it('uses only the reduced own-item projection for merchants', async () => {
    vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
      organization: { id: scope.organizationId, role: 'MERCHANT' },
    } as never);
    request.mockImplementation(async (path: string) =>
      path.endsWith(`/refunds/${staffRefund.id}`) ? merchantRefund : ownSale,
    );
    const {
      paymentAccountId,
      paymentAccountName,
      paymentAccountIsCash,
      paymentAccountRequiresReference,
      actorName,
      merchantNames,
      ...item
    } = page.items[0];
    void paymentAccountId;
    void paymentAccountName;
    void paymentAccountIsCash;
    void paymentAccountRequiresReference;
    void actorName;
    void merchantNames;
    render(
      <TransactionsTab
        {...props}
        merchant
        page={{ ...page, scope: 'MERCHANT', items: [item] }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(
      await screen.findByText('Own returned items subtotal'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Actual refund method')).toBeNull();
    expect(screen.queryByText(staffRefund.reason)).toBeNull();
    expect(navigation.push).not.toHaveBeenCalled();
  });
  it('rejects incompatible original snapshots and permits GET-only retry', async () => {
    request.mockRejectedValueOnce(new ApiError(403, 'Access changed.'));
    render(<TransactionsTab {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(await screen.findByText('Access changed.')).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
    request.mockImplementation(async (path: string) =>
      path.endsWith(`/refunds/${staffRefund.id}`)
        ? { ...staffRefund, receiptCode: 'WRONG' }
        : completedSale,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText('Refund detail could not be loaded.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(staffRefund.reason)).toBeNull();
    expect(request.mock.calls.every((call) => call.length === 1)).toBe(true);
  });
  it('discards late modal reads when the report page changes', async () => {
    let resolve!: (value: unknown) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const view = render(<TransactionsTab {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    view.rerender(
      <TransactionsTab
        {...props}
        page={{ ...page, items: [], total: 0, totalPages: 0 }}
      />,
    );
    await act(async () => resolve(completedSale));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(request).toHaveBeenCalledOnce();
  });
});
