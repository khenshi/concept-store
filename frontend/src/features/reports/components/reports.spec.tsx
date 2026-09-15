import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { ReportsEntry } from './reports-entry';
import { BranchReports } from './branch-reports';
import { StaffReportSummary } from './staff-report-summary';
import { MerchantReportSummary } from './merchant-report-summary';
import type {
  StaffSalesAnalytics,
  StaffSalesReport,
} from '../model/report.schemas';
import type { MerchantSalesReport } from '../model/report.schemas';
import type { MerchantSalesAnalytics } from '../model/report.schemas';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));
vi.mock('@/features/auth/model/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock(
  '@/features/organizations/components/organization-workspace-context',
  () => ({ useOrganizationWorkspaceContext: vi.fn() }),
);
const branch = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Main',
  code: 'MAIN',
};
const second = {
  ...branch,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'South',
};
const range = {
  from: '2026-09-13T16:00:00.000Z',
  until: '2026-09-14T16:00:00.000Z',
};
const report: StaffSalesReport = {
  scope: 'STAFF',
  branch,
  ...range,
  grossSales: '60.00',
  transactionCount: '3',
  unitsSold: '5',
  refundedAmount: '0.00',
  refundCount: '0',
  returnedUnits: '0',
  netRecordedSales: '60.00',
  refundMethods: (['CASH', 'GCASH', 'CARD'] as const).map((paymentMethod) => ({
    paymentMethod,
    refundedAmount: '0.00',
    refundCount: '0',
  })),
  payments: [
    { paymentMethod: 'CASH', grossSales: '10.00', transactionCount: '1' },
    { paymentMethod: 'GCASH', grossSales: '20.00', transactionCount: '1' },
    { paymentMethod: 'CARD', grossSales: '30.00', transactionCount: '1' },
  ],
};
const analyticsReport: StaffSalesAnalytics = {
  ...report,
  dailyTrends: [
    {
      date: '2026-09-14',
      grossSales: '60.00',
      transactionCount: '3',
      unitsSold: '5',
      refundedAmount: '0.00',
      refundCount: '0',
      returnedUnits: '0',
      netRecordedSales: '60.00',
    },
  ],
  topProducts: [
    {
      productId: '33333333-3333-4333-8333-333333333333',
      productName: 'Canvas tote',
      sku: 'TOTE-1',
      barcode: null,
      merchantName: 'Local maker',
      grossSales: '60.00',
      unitsSold: '5',
      refundedAmount: '0.00',
      returnedUnits: '0',
      netRecordedSales: '60.00',
    },
  ],
  totalProducts: '1',
};
function analyticsFor(path: string): StaffSalesAnalytics {
  const query = new URLSearchParams(path.split('?')[1]);
  const from = query.get('from') ?? range.from;
  const until = query.get('until') ?? range.until;
  const count = (Date.parse(until) - Date.parse(from)) / 86400000;
  const dailyTrends = Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.parse(from) + (index + 1) * 86400000)
      .toISOString()
      .slice(0, 10);
    return index === count - 1
      ? { ...analyticsReport.dailyTrends[0], date }
      : {
          ...analyticsReport.dailyTrends[0],
          date,
          grossSales: '0.00',
          transactionCount: '0',
          unitsSold: '0',
          netRecordedSales: '0.00',
        };
  });
  return { ...analyticsReport, from, until, dailyTrends };
}
const request = vi.fn();
const push = vi.fn();
const refreshOrganization = vi.fn();
const setSelectedBranchId = vi.fn();
function context(role = 'OWNER', id = 'org', status = 'ready') {
  vi.mocked(useOrganizationWorkspaceContext).mockReturnValue({
    organization: { id, name: 'Store', role },
    organizationStatus: status,
    refreshOrganization,
    selectedBranchId: null,
    setSelectedBranchId,
  } as unknown as ReturnType<typeof useOrganizationWorkspaceContext>);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
describe('staff Reports workspace', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Freeze the calendar without blocking asynchronous component timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-13T16:30:00Z'));
    vi.mocked(useAuth).mockReturnValue({
      request,
      user: { id: 'user' },
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<
      typeof useRouter
    >);
    context();
    request.mockImplementation(async (path: string) =>
      path.endsWith('/reports/sales/branches')
        ? [branch, second]
        : {
            ...(path.includes('/analytics') ? analyticsFor(path) : report),
            branch: path.includes(`/branches/${second.id}/`) ? second : branch,
            ...Object.fromEntries(new URLSearchParams(path.split('?')[1])),
          },
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('requires explicit selection even for one branch and uses no summary/general branch read', async () => {
    request.mockResolvedValue([branch]);
    render(<ReportsEntry organizationId="org" />);
    const picker = await screen.findByRole('combobox', {
      name: 'Reports branch',
    });
    await waitFor(() => expect(picker).toBeEnabled());
    expect(picker).toHaveTextContent('Choose a branch');
    expect(push).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledExactlyOnceWith(
      '/organizations/org/reports/sales/branches',
    );
    fireEvent.click(picker);
    fireEvent.click(screen.getByRole('option', { name: 'Main (MAIN)' }));
    expect(push).toHaveBeenCalledWith(
      `/app/organizations/org/branches/${branch.id}/reports`,
    );
  });
  it.each(['CASHIER'])(
    'does not read or render staff Reports for %s',
    (role) => {
      context(role);
      render(<BranchReports organizationId="org" branchId={branch.id} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(request).not.toHaveBeenCalled();
      expect(
        screen.queryByRole('list', { name: 'Payment breakdown' }),
      ).not.toBeInTheDocument();
    },
  );
  it('shows empty assignments and safely retries a failed entry read', async () => {
    request
      .mockRejectedValueOnce(new ApiError(403, 'Denied'))
      .mockResolvedValueOnce([]);
    render(<ReportsEntry organizationId="org" />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText(/No accessible report branches/),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh access' }));
    expect(refreshOrganization).toHaveBeenCalled();
  });
  it('reads today in Philippines after authorized lookup and displays manual payment labels', async () => {
    context('MANAGER');
    render(<BranchReports organizationId="org" branchId={branch.id} />);
    expect((await screen.findAllByText('PHP 60.00'))[0]).toBeInTheDocument();
    expect(request.mock.calls[0][0]).toBe(
      '/organizations/org/reports/sales/branches',
    );
    expect(request.mock.calls[1][0]).toContain(
      new URLSearchParams(range).toString(),
    );
    expect(screen.getByLabelText('From (Philippines, inclusive)')).toHaveValue(
      '2026-09-14',
    );
    expect(screen.getAllByText('GCash (manual, unverified)')).toHaveLength(2);
    expect(screen.getAllByText('Card (manual, unverified)')).toHaveLength(2);
  });
  it('does not fetch a summary for an inaccessible branch or select a fallback', async () => {
    request.mockResolvedValue([second]);
    render(<BranchReports organizationId="org" branchId={branch.id} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'no longer available',
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });
  it('blocks invalid dates, does not read while typing, and reads only on valid Apply', async () => {
    render(<BranchReports organizationId="org" branchId={branch.id} />);
    await screen.findAllByText('PHP 60.00');
    const from = screen.getByLabelText('From (Philippines, inclusive)');
    fireEvent.change(from, { target: { value: '' } });
    expect(
      screen.getByRole('button', { name: 'Refresh report' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply period' }));
    expect(request).toHaveBeenCalledTimes(2);
    fireEvent.change(from, { target: { value: '2026-09-13' } });
    expect(request).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Apply period' }));
    expect(screen.queryByText('PHP 60.00')).not.toBeInTheDocument();
    await waitFor(() => expect(request).toHaveBeenCalledTimes(4));
    expect(request.mock.calls[3][0]).toContain(
      'from=2026-09-12T16%3A00%3A00.000Z',
    );
  });
  it('clears old totals/payment rows on failed or revoked refresh and retries reads only', async () => {
    render(<BranchReports organizationId="org" branchId={branch.id} />);
    await screen.findAllByText('PHP 60.00');
    request.mockRejectedValueOnce(new ApiError(403, 'Reports access revoked'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh report' }));
    expect(screen.queryByText('PHP 60.00')).not.toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Reports access revoked',
    );
    expect(
      screen.queryByRole('list', { name: 'Payment breakdown' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh access' }));
    expect(refreshOrganization).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findAllByText('PHP 60.00');
    expect(request.mock.calls.every((call) => call.length === 1)).toBe(true);
  });
  it('rejects late responses after applying a different period', async () => {
    const old = deferred<StaffSalesAnalytics>();
    request.mockResolvedValueOnce([branch]).mockReturnValueOnce(old.promise);
    render(<BranchReports organizationId="org" branchId={branch.id} />);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText('From (Philippines, inclusive)'), {
      target: { value: '2026-09-13' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply period' }));
    await screen.findAllByText('PHP 60.00');
    await act(async () =>
      old.resolve({
        ...analyticsReport,
        grossSales: '99.00',
        payments: report.payments.map((payment, i) =>
          i ? payment : { ...payment, grossSales: '49.00' },
        ),
      }),
    );
    expect(screen.queryByText('PHP 99.00')).not.toBeInTheDocument();
    expect(screen.getByText(/Applied period/)).toHaveTextContent(
      '2026-09-13 through 2026-09-14',
    );
  });
  it('clears scoped data when the role or organization access changes', async () => {
    const view = render(
      <BranchReports organizationId="org" branchId={branch.id} />,
    );
    await screen.findAllByText('PHP 60.00');
    context('CASHIER');
    view.rerender(<BranchReports organizationId="org" branchId={branch.id} />);
    expect(screen.queryByText('PHP 60.00')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'cannot access Reports',
    );
    context('OWNER', 'another-org');
    view.rerender(<BranchReports organizationId="org" branchId={branch.id} />);
    expect(
      screen.queryByRole('list', { name: 'Payment breakdown' }),
    ).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('resets the date period and scoped data on a branch route change', async () => {
    const view = render(
      <BranchReports organizationId="org" branchId={branch.id} />,
    );
    await screen.findAllByText('PHP 60.00');
    fireEvent.change(screen.getByLabelText('From (Philippines, inclusive)'), {
      target: { value: '2026-09-13' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply period' }));
    await screen.findAllByText('PHP 60.00');
    view.rerender(<BranchReports organizationId="org" branchId={second.id} />);
    expect(screen.queryByText('PHP 60.00')).not.toBeInTheDocument();
    expect(screen.getByLabelText('From (Philippines, inclusive)')).toHaveValue(
      '2026-09-14',
    );
    await screen.findAllByText('PHP 60.00');
    expect(request.mock.calls.at(-1)?.[0]).toContain(
      `/branches/${second.id}/reports/sales/analytics?${new URLSearchParams(range)}`,
    );
  });
  it('ignores an old user response after the authenticated user changes', async () => {
    const old = deferred<StaffSalesAnalytics>();
    request.mockResolvedValueOnce([branch]).mockReturnValueOnce(old.promise);
    const view = render(
      <BranchReports organizationId="org" branchId={branch.id} />,
    );
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    vi.mocked(useAuth).mockReturnValue({
      request,
      user: { id: 'new-user' },
    } as unknown as ReturnType<typeof useAuth>);
    view.rerender(<BranchReports organizationId="org" branchId={branch.id} />);
    await screen.findAllByText('PHP 60.00');
    await act(async () =>
      old.resolve({
        ...analyticsReport,
        grossSales: '99.00',
        payments: report.payments.map((payment, i) =>
          i ? payment : { ...payment, grossSales: '49.00' },
        ),
      }),
    );
    expect(screen.queryByText('PHP 99.00')).not.toBeInTheDocument();
  });
  it('rejects staff-shaped fallback after a role change at the API boundary', async () => {
    render(<BranchReports organizationId="org" branchId={branch.id} />);
    await screen.findAllByText('PHP 60.00');
    request.mockResolvedValueOnce([branch]).mockResolvedValueOnce({
      scope: 'MERCHANT',
      branch,
      ...range,
      ownGrossSales: '20.00',
      ownTransactionCount: '1',
      ownUnitsSold: '1',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh report' }));
    await screen.findByRole('alert');
    expect(screen.queryByText('PHP 60.00')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: 'Payment breakdown' }),
    ).not.toBeInTheDocument();
  });
  it('clears totals before branch navigation without a back button', async () => {
    render(<BranchReports organizationId="org" branchId={branch.id} />);
    await screen.findAllByText('PHP 60.00');
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'South (MAIN)' }));
    expect(screen.queryByText('PHP 60.00')).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledWith(
      `/app/organizations/org/branches/${second.id}/reports`,
    );
    expect(
      screen.queryByRole('button', { name: /back/i }),
    ).not.toBeInTheDocument();
  });
  it('renders exact large values and empty period payment rows without exports/printing', () => {
    const view = render(
      <StaffReportSummary
        report={{
          ...report,
          grossSales: '999999999999999999999999999999.01',
          netRecordedSales: '999999999999999999999999999999.01',
          transactionCount: '9007199254740993',
          unitsSold: '9007199254740994',
        }}
      />,
    );
    expect(
      screen.getByText('PHP 999999999999999999999999999999.01'),
    ).toBeInTheDocument();
    expect(screen.getByText('9007199254740993')).toBeInTheDocument();
    view.rerender(
      <StaffReportSummary
        report={{
          ...report,
          grossSales: '0.00',
          netRecordedSales: '0.00',
          transactionCount: '0',
          unitsSold: '0',
          payments: report.payments.map((p) => ({
            ...p,
            grossSales: '0.00',
            transactionCount: '0',
          })),
        }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('No completed sales');
    expect(
      within(
        screen.getByRole('list', { name: 'Payment breakdown' }),
      ).getAllByRole('listitem'),
    ).toHaveLength(3);
    expect(
      screen.queryByRole('button', { name: /export|print/i }),
    ).not.toBeInTheDocument();
  });

  describe('merchant own-only workspace', () => {
    const own: MerchantSalesReport = {
      scope: 'MERCHANT',
      branch,
      ...range,
      ownGrossSales: '25.00',
      ownTransactionCount: '1',
      ownUnitsSold: '2',
      ownRefundedAmount: '0.00',
      ownRefundCount: '0',
      ownReturnedUnits: '0',
      ownNetRecordedSales: '25.00',
    };
    const ownAnalytics: MerchantSalesAnalytics = {
      ...own,
      dailyTrends: [
        {
          date: '2026-09-14',
          ownGrossSales: '25.00',
          ownTransactionCount: '1',
          ownUnitsSold: '2',
          ownRefundedAmount: '0.00',
          ownRefundCount: '0',
          ownReturnedUnits: '0',
          ownNetRecordedSales: '25.00',
        },
      ],
      topProducts: [
        {
          productId: '44444444-4444-4444-8444-444444444444',
          productName: 'Own saved product',
          sku: null,
          barcode: null,
          merchantName: 'Own merchant',
          ownGrossSales: '25.00',
          ownUnitsSold: '2',
          ownRefundedAmount: '0.00',
          ownReturnedUnits: '0',
          ownNetRecordedSales: '25.00',
        },
      ],
      totalProducts: '1',
    };
    function ownAnalyticsFor(path: string) {
      const query = new URLSearchParams(path.split('?')[1]);
      const from = query.get('from') ?? range.from;
      const until = query.get('until') ?? range.until;
      const count = (Date.parse(until) - Date.parse(from)) / 86400000;
      return {
        ...ownAnalytics,
        from,
        until,
        dailyTrends: Array.from({ length: count }, (_, index) => {
          const date = new Date(Date.parse(from) + (index + 1) * 86400000)
            .toISOString()
            .slice(0, 10);
          return index === count - 1
            ? { ...ownAnalytics.dailyTrends[0], date }
            : {
                ...ownAnalytics.dailyTrends[0],
                date,
                ownGrossSales: '0.00',
                ownTransactionCount: '0',
                ownUnitsSold: '0',
                ownNetRecordedSales: '0.00',
              };
        }),
      };
    }
    beforeEach(() => {
      context('MERCHANT');
      request.mockImplementation(async (path: string) =>
        path.endsWith('/reports/sales/branches')
          ? [branch, second]
          : {
              ...ownAnalyticsFor(path),
              branch: path.includes(`/branches/${second.id}/`)
                ? second
                : branch,
              ...Object.fromEntries(new URLSearchParams(path.split('?')[1])),
            },
      );
    });
    it('shows own amounts only, without payment/whole-sale/actor data or mutation/print controls', async () => {
      render(<BranchReports organizationId="org" branchId={branch.id} />);
      await screen.findAllByText('PHP 25.00');
      expect(
        screen.getByRole('heading', { name: 'Own-sales reports' }),
      ).toBeInTheDocument();
      expect(screen.getAllByText('Transactions with own items')).toHaveLength(
        2,
      );
      expect(
        screen.queryByRole('list', { name: 'Payment breakdown' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText('PHP 60.00')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /print|export|checkout|pay/i }),
      ).not.toBeInTheDocument();
      expect(
        request.mock.calls.every(
          (call) => call.length === 1 && call[0].includes('/reports/sales'),
        ),
      ).toBe(true);
      expect(request.mock.calls[1][0]).toContain('/reports/sales/analytics?');
    });
    it('requires explicit historical/assigned branch choice and offers link/access guidance', async () => {
      render(<ReportsEntry organizationId="org" />);
      await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
      expect(screen.getByRole('combobox')).toHaveTextContent('Choose a branch');
      expect(
        screen.getByText(/An assignment alone does not grant whole-branch/),
      ).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('combobox'));
      fireEvent.click(screen.getByRole('option', { name: 'South (MAIN)' }));
      expect(push).toHaveBeenCalledWith(
        `/app/organizations/org/branches/${second.id}/reports`,
      );
      expect(request).toHaveBeenCalledTimes(1);
    });
    it('explains no assigned/historical access without inventing a link state or fallback', async () => {
      request.mockResolvedValue([]);
      render(<ReportsEntry organizationId="org" />);
      expect(await screen.findByRole('status')).toHaveTextContent(
        'No assigned or historical own-selling branches',
      );
      expect(screen.getByRole('combobox')).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Refresh access' }));
      expect(refreshOrganization).toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });
    it('keeps historical branch choices in an empty period and explains unlinked assigned zeros', async () => {
      request.mockImplementation(async (path: string) =>
        path.endsWith('/reports/sales/branches')
          ? [branch, second]
          : {
              ...ownAnalyticsFor(path),
              ...Object.fromEntries(new URLSearchParams(path.split('?')[1])),
              ownGrossSales: '0.00',
              ownNetRecordedSales: '0.00',
              ownTransactionCount: '0',
              ownUnitsSold: '0',
              dailyTrends: ownAnalyticsFor(path).dailyTrends.map((row) => ({
                ...row,
                ownGrossSales: '0.00',
                ownTransactionCount: '0',
                ownUnitsSold: '0',
                ownNetRecordedSales: '0.00',
              })),
              topProducts: [],
              totalProducts: '0',
            },
      );
      render(<BranchReports organizationId="org" branchId={branch.id} />);
      await screen.findByText(/No completed sales or refunds involving your/);
      expect(
        screen.getByText(/If your profile is not linked/),
      ).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('From (Philippines, inclusive)'), {
        target: { value: '2026-09-13' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Apply period' }));
      await screen.findAllByText('PHP 0.00');
      fireEvent.click(screen.getByRole('combobox'));
      expect(
        screen.getByRole('option', { name: 'South (MAIN)' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('list', { name: 'Payment breakdown' }),
      ).not.toBeInTheDocument();
    });
    it.each(['STAFF', 'PRIVATE'])(
      'clears old own values and rejects %s data on refresh',
      async (kind) => {
        render(<BranchReports organizationId="org" branchId={branch.id} />);
        await screen.findAllByText('PHP 25.00');
        request
          .mockResolvedValueOnce([branch])
          .mockResolvedValueOnce(
            kind === 'STAFF' ? report : { ...own, payments: report.payments },
          );
        fireEvent.click(screen.getByRole('button', { name: 'Refresh report' }));
        expect(screen.queryByText('PHP 25.00')).not.toBeInTheDocument();
        await screen.findByRole('alert');
        expect(
          screen.queryByRole('list', { name: 'Payment breakdown' }),
        ).not.toBeInTheDocument();
        expect(screen.queryByText('PHP 60.00')).not.toBeInTheDocument();
      },
    );
    it('clears and reloads current-link data on access refresh, ignoring a prior profile response', async () => {
      const old = deferred<MerchantSalesAnalytics>();
      request.mockResolvedValueOnce([branch]).mockReturnValueOnce(old.promise);
      const view = render(
        <BranchReports organizationId="org" branchId={branch.id} />,
      );
      await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
      fireEvent.click(screen.getByRole('button', { name: 'Refresh access' }));
      context('MERCHANT', 'org', 'loading');
      view.rerender(
        <BranchReports organizationId="org" branchId={branch.id} />,
      );
      await act(async () =>
        old.resolve({ ...ownAnalytics, ownGrossSales: '99.00' }),
      );
      expect(screen.queryByText('PHP 99.00')).not.toBeInTheDocument();
      context('MERCHANT');
      view.rerender(
        <BranchReports organizationId="org" branchId={branch.id} />,
      );
      await screen.findAllByText('PHP 25.00');
      expect(request).toHaveBeenCalledTimes(4);
    });
    it('clears own summary on revoked branch access and allows read-only retry', async () => {
      render(<BranchReports organizationId="org" branchId={branch.id} />);
      await screen.findAllByText('PHP 25.00');
      request.mockResolvedValueOnce([second]);
      fireEvent.click(screen.getByRole('button', { name: 'Refresh report' }));
      await screen.findByRole('alert');
      expect(screen.queryByText('PHP 25.00')).not.toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await screen.findAllByText('PHP 25.00');
      expect(request.mock.calls.every((call) => call.length === 1)).toBe(true);
    });
    it('ignores a late staff response after changing to the merchant role', async () => {
      context('OWNER');
      const old = deferred<StaffSalesAnalytics>();
      request.mockResolvedValueOnce([branch]).mockReturnValueOnce(old.promise);
      const view = render(
        <BranchReports organizationId="org" branchId={branch.id} />,
      );
      await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
      context('MERCHANT');
      view.rerender(
        <BranchReports organizationId="org" branchId={branch.id} />,
      );
      await screen.findAllByText('PHP 25.00');
      await act(async () => old.resolve(analyticsReport));
      expect(screen.queryByText('PHP 60.00')).not.toBeInTheDocument();
      expect(request.mock.calls[1][0]).not.toContain('/reports/sales?');
      expect(
        screen.queryByRole('list', { name: 'Payment breakdown' }),
      ).not.toBeInTheDocument();
    });
    it('rejects an obsolete own response after applying a new period', async () => {
      const old = deferred<MerchantSalesAnalytics>();
      request.mockResolvedValueOnce([branch]).mockReturnValueOnce(old.promise);
      render(<BranchReports organizationId="org" branchId={branch.id} />);
      await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
      fireEvent.change(screen.getByLabelText('From (Philippines, inclusive)'), {
        target: { value: '2026-09-13' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Apply period' }));
      await screen.findAllByText('PHP 25.00');
      await act(async () =>
        old.resolve({ ...ownAnalytics, ownGrossSales: '99.00' }),
      );
      expect(screen.queryByText('PHP 99.00')).not.toBeInTheDocument();
    });
    it('renders large own amounts and counters exactly without payments', () => {
      render(
        <MerchantReportSummary
          report={{
            ...own,
            ownGrossSales: '999999999999999999999999999999.01',
            ownNetRecordedSales: '999999999999999999999999999999.01',
            ownTransactionCount: '9007199254740993',
            ownUnitsSold: '9007199254740994',
          }}
        />,
      );
      expect(
        screen.getByText('PHP 999999999999999999999999999999.01'),
      ).toBeInTheDocument();
      expect(screen.getByText('9007199254740993')).toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
  });
});
