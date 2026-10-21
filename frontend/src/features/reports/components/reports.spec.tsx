import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { ReportsEntry } from './reports-entry';
import { BranchReports, ReportView } from './branch-reports';
import { reportTabFromPath } from '../model/report-location';
import { StaffReportSummary } from './staff-report-summary';
import { MerchantReportSummary } from './merchant-report-summary';
import type {
  StaffSalesAnalytics,
  StaffSalesReport,
} from '../model/report.schemas';
import type { MerchantSalesReport } from '../model/report.schemas';
import type { MerchantSalesAnalytics } from '../model/report.schemas';

const navigationState = vi.hoisted(() => ({
  href: '',
  listeners: new Set<() => void>(),
}));
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const useHref = () =>
    useSyncExternalStore(
      (listener) => {
        navigationState.listeners.add(listener);
        return () => {
          navigationState.listeners.delete(listener);
        };
      },
      () => navigationState.href,
    );
  return {
    useRouter: vi.fn(),
    usePathname: () =>
      new URL(useHref() || '/reports/overview', 'http://localhost').pathname,
    useSearchParams: () =>
      new URLSearchParams(
        new URL(useHref() || '/reports/overview', 'http://localhost').search,
      ),
  };
});
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
  netByPaymentMethod: [
    { paymentMethod: 'CASH', netRecordedSales: '10.00' },
    { paymentMethod: 'GCASH', netRecordedSales: '20.00' },
    { paymentMethod: 'CARD', netRecordedSales: '30.00' },
  ],
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
  topMerchants: [
    {
      merchantId: '44444444-4444-4444-8444-444444444444',
      merchantName: 'Local maker',
      grossSales: '60.00',
    },
  ],
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
function rankingFor(path: string) {
  const query = new URLSearchParams(path.split('?')[1]);
  const from = query.get('from') ?? range.from;
  const until = query.get('until') ?? range.until;
  const page = Number(query.get('page') ?? '1');
  return {
    scope: 'STAFF' as const,
    branch,
    from,
    until,
    sortBy: (query.get('sortBy') ?? 'GROSS_SALES') as
      'GROSS_SALES' | 'UNITS_SOLD',
    merchantId: query.get('merchantId'),
    page,
    limit: 15 as const,
    totalProducts: analyticsReport.totalProducts,
    hasNext: false,
    items: analyticsReport.topProducts,
  };
}
function transactionsFor(path: string) {
  const query = new URLSearchParams(path.split('?')[1]);
  return {
    scope: 'STAFF' as const,
    branch,
    from: query.get('from') ?? range.from,
    until: query.get('until') ?? range.until,
    page: Number(query.get('page') ?? '1'),
    limit: Number(query.get('limit') ?? '25'),
    total: 1,
    totalPages: 1,
    items: [
      {
        type: 'SALE' as const,
        id: '33333333-3333-4333-8333-333333333333',
        saleId: '33333333-3333-4333-8333-333333333333',
        refundId: null,
        completedAt: '2026-09-14T05:00:00.000Z',
        reference: 'RCPT-001',
        amount: '25.00',
        paymentMethod: 'CASH' as const,
        actorName: 'Cashier One',
        merchantNames: ['Local maker'],
      },
    ],
  };
}
const request = vi.fn();
const push = vi.fn();
const replace = vi.fn();
const refreshOrganization = vi.fn();
const setSelectedBranchId = vi.fn();
function RoutedReportView() {
  return <ReportView tab={reportTabFromPath(usePathname())} />;
}
function restoreReportUrl(href: string) {
  navigationState.href = href;
  for (const listener of navigationState.listeners) listener();
}
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

function chooseReportDates(...days: string[]) {
  fireEvent.click(screen.getByRole('button', { name: 'Report date filter' }));
  for (const day of days) {
    const label = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${day}T00:00:00.000Z`));
    fireEvent.click(screen.getByRole('gridcell', { name: label }));
  }
}

describe('staff Reports workspace', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    navigationState.href = '';
    // Freeze the calendar without blocking asynchronous component timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-13T16:30:00Z'));
    vi.mocked(useAuth).mockReturnValue({
      request,
      user: { id: 'user' },
    } as unknown as ReturnType<typeof useAuth>);
    push.mockImplementation((href: string) => {
      if (!new URL(href, 'http://localhost').pathname.includes('/reports'))
        return;
      navigationState.href = href;
      for (const listener of navigationState.listeners) listener();
    });
    replace.mockImplementation((href: string) => restoreReportUrl(href));
    vi.mocked(useRouter).mockReturnValue({
      push,
      replace,
    } as unknown as ReturnType<typeof useRouter>);
    context();
    request.mockImplementation(async (path: string) =>
      path.endsWith('/reports/sales/branches')
        ? [branch, second]
        : path.includes('/merchants')
          ? [
              {
                id: '44444444-4444-4444-8444-444444444444',
                organizationId: '11111111-1111-4111-8111-111111111111',
                name: 'Local maker',
                code: 'LOCAL',
                contactName: 'Contact',
                email: null,
                phone: '09171234567',
                status: 'ACTIVE',
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ]
          : path.includes('/transactions')
            ? transactionsFor(path)
            : path.includes('/rankings')
              ? rankingFor(path)
              : {
                  ...(path.includes('/analytics')
                    ? analyticsFor(path)
                    : report),
                  branch: path.includes(`/branches/${second.id}/`)
                    ? second
                    : branch,
                  ...Object.fromEntries(
                    new URLSearchParams(path.split('?')[1]),
                  ),
                },
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('switches nested pages while retaining the same header and applied dates', async () => {
    render(
      <BranchReports organizationId="org" branchId={branch.id}>
        <RoutedReportView />
      </BranchReports>,
    );
    await screen.findAllByText('PHP 60.00');
    const header = screen.getByRole('heading', { name: 'Sales reports' });
    fireEvent.click(screen.getByRole('tab', { name: 'Transactions' }));
    expect(
      await screen.findByRole('table', { name: 'Transaction history' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sales reports' })).toBe(header);
    expect(screen.getByRole('tab', { name: 'Transactions' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(new URL(navigationState.href, 'http://localhost').pathname).toBe(
      `/app/organizations/org/branches/${branch.id}/reports/transactions`,
    );
    expect(
      request.mock.calls.filter(([path]) => path.includes('/sales/analytics?')),
    ).toHaveLength(1);
    const transactionUrl = navigationState.href;
    fireEvent.click(screen.getByRole('tab', { name: 'Daily Data' }));
    expect(
      await screen.findByRole('table', {
        name: 'Daily sales data in Asia/Manila',
      }),
    ).toBeInTheDocument();
    expect(
      new URL(navigationState.href, 'http://localhost').pathname,
    ).toContain('/reports/daily-data');
    act(() => restoreReportUrl(transactionUrl));
    expect(
      await screen.findByRole('table', { name: 'Transaction history' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sales reports' })).toBe(header);
    expect(
      request.mock.calls.filter(([path]) => path.includes('/sales/analytics?')),
    ).toHaveLength(1);
  });
  it('captures the queryless initial period so Back restores it after applying another period', async () => {
    render(
      <BranchReports organizationId="org" branchId={branch.id}>
        <RoutedReportView />
      </BranchReports>,
    );
    await screen.findAllByText('PHP 60.00');
    const initial = navigationState.href;
    expect(
      new URL(initial, 'http://localhost').searchParams.get('preset'),
    ).toBe('TODAY');
    fireEvent.click(screen.getByRole('combobox', { name: 'Period' }));
    fireEvent.click(screen.getByRole('option', { name: 'This month' }));
    await screen.findAllByText('PHP 60.00');
    expect(
      new URL(navigationState.href, 'http://localhost').searchParams.get(
        'preset',
      ),
    ).toBe('THIS_MONTH');
    act(() => restoreReportUrl(initial));
    await screen.findAllByText('PHP 60.00');
    expect(screen.getByRole('combobox', { name: 'Period' })).toHaveTextContent(
      'Today',
    );
    expect(request.mock.calls.at(-1)![0]).toContain(
      new URLSearchParams(range).toString(),
    );
  });
  it('does not resurrect a committed search draft when Back restores its old source query', async () => {
    navigationState.href = `/app/organizations/org/branches/${branch.id}/reports/transactions?preset=TODAY&fromDay=2026-09-14&throughDay=2026-09-14&transactionQ=OLD`;
    render(
      <BranchReports organizationId="org" branchId={branch.id}>
        <RoutedReportView />
      </BranchReports>,
    );
    await screen.findByRole('table', { name: 'Transaction history' });
    const original = navigationState.href;
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search transactions' }),
      { target: { value: 'NEW ' } },
    );
    await waitFor(() =>
      expect(
        new URL(navigationState.href, 'http://localhost').searchParams.get(
          'transactionQ',
        ),
      ).toBe('NEW'),
    );
    await screen.findByRole('table', { name: 'Transaction history' });
    act(() => restoreReportUrl(original));
    expect(
      screen.getByRole('searchbox', { name: 'Search transactions' }),
    ).toHaveValue('OLD');
    await waitFor(() =>
      expect(
        request.mock.calls
          .filter(([path]) => path.includes('/transactions?'))
          .at(-1)![0],
      ).toContain('q=OLD'),
    );
    expect(navigationState.href).toBe(original);
  });
  it.each(['', 'OLD'])(
    'keeps loaded transactions when whitespace leaves normalized search unchanged: %s',
    async (q) => {
      navigationState.href = `/app/organizations/org/branches/${branch.id}/reports/transactions?preset=TODAY&fromDay=2026-09-14&throughDay=2026-09-14&transactionQ=${q}`;
      render(
        <BranchReports organizationId="org" branchId={branch.id}>
          <RoutedReportView />
        </BranchReports>,
      );
      await screen.findByRole('table', { name: 'Transaction history' });
      const count = request.mock.calls.filter(([path]) =>
        path.includes('/transactions?'),
      ).length;
      fireEvent.change(
        screen.getByRole('searchbox', { name: 'Search transactions' }),
        { target: { value: `${q}   ` } },
      );
      expect(
        screen.getByRole('table', { name: 'Transaction history' }),
      ).toBeInTheDocument();
      expect(
        request.mock.calls.filter(([path]) => path.includes('/transactions?')),
      ).toHaveLength(count);
    },
  );
  it('does not display a ranking error from another restored page or filter', async () => {
    const base = `/app/organizations/org/branches/${branch.id}/reports/rankings?preset=TODAY&fromDay=2026-09-14&throughDay=2026-09-14`;
    navigationState.href = `${base}&rankingSort=UNITS_SOLD&rankingPage=2`;
    const original = request.getMockImplementation()!;
    request.mockImplementation(async (path: string) => {
      if (path.includes('/rankings?') && path.includes('sortBy=UNITS_SOLD'))
        throw new ApiError(503, 'Old ranking failed.');
      if (path.includes('/rankings?')) return new Promise(() => {});
      return original(path);
    });
    render(
      <BranchReports organizationId="org" branchId={branch.id}>
        <RoutedReportView />
      </BranchReports>,
    );
    await screen.findByText('Old ranking failed.');
    act(() => restoreReportUrl(base));
    expect(screen.queryByText('Old ranking failed.')).toBeNull();
    await waitFor(() =>
      expect(
        request.mock.calls.some(
          ([path]) =>
            path.includes('/rankings?') && path.includes('sortBy=GROSS_SALES'),
        ),
      ).toBe(true),
    );
    expect(screen.queryByText('Old ranking failed.')).toBeNull();
  });
  it('restores a direct transaction link and its filters after remount', async () => {
    const href = `/app/organizations/org/branches/${branch.id}/reports/transactions?preset=CUSTOM&fromDay=2026-09-13&throughDay=2026-09-14&transactionQ=REF&transactionType=REFUND&transactionPage=2`;
    navigationState.href = href;
    const original = request.getMockImplementation()!;
    request.mockImplementation(async (path: string) =>
      path.includes('/transactions?')
        ? { ...transactionsFor(path), total: 16, totalPages: 2 }
        : original(path),
    );
    const first = render(
      <BranchReports organizationId="org" branchId={branch.id}>
        <RoutedReportView />
      </BranchReports>,
    );
    await screen.findByLabelText('Page 2/2');
    expect(
      screen.getByRole('searchbox', { name: 'Search transactions' }),
    ).toHaveValue('REF');
    expect(
      screen.getByRole('combobox', { name: 'Transaction type' }),
    ).toHaveTextContent('Refunds');
    const last = new URL(
      request.mock.calls
        .filter(([path]) => path.includes('/transactions?'))
        .at(-1)![0],
      'http://localhost',
    ).searchParams;
    expect(Object.fromEntries(last)).toMatchObject({
      page: '2',
      type: 'REFUND',
      q: 'REF',
      from: '2026-09-12T16:00:00.000Z',
      until: range.until,
    });
    first.unmount();
    render(
      <BranchReports organizationId="org" branchId={branch.id}>
        <RoutedReportView />
      </BranchReports>,
    );
    await screen.findByLabelText('Page 2/2');
    expect(
      screen.getByRole('searchbox', { name: 'Search transactions' }),
    ).toHaveValue('REF');
    expect(navigationState.href).toBe(href);
  });
  it('restores ranking controls and page from a direct nested link', async () => {
    navigationState.href = `/app/organizations/org/branches/${branch.id}/reports/rankings?preset=TODAY&fromDay=2026-09-14&throughDay=2026-09-14&rankingPage=2&rankingSort=UNITS_SOLD&rankingMerchant=44444444-4444-4444-8444-444444444444`;
    render(
      <BranchReports organizationId="org" branchId={branch.id}>
        <RoutedReportView />
      </BranchReports>,
    );
    await waitFor(() =>
      expect(
        request.mock.calls.some(
          ([path]) =>
            path.includes('/rankings?') &&
            path.includes('page=2') &&
            path.includes('sortBy=UNITS_SOLD') &&
            path.includes('merchantId=44444444-4444-4444-8444-444444444444'),
        ),
      ).toBe(true),
    );
    expect(screen.getByRole('combobox', { name: 'Rank by' })).toHaveTextContent(
      'Units sold',
    );
    expect(screen.getByRole('tab', { name: 'Rankings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
  it('restores short-period daily pagination through browser Back without reloading analytics', async () => {
    const href = `/app/organizations/org/branches/${branch.id}/reports/daily-data?preset=CUSTOM&fromDay=2026-08-01&throughDay=2026-09-14&dailyPage=2`;
    navigationState.href = href;
    render(
      <BranchReports organizationId="org" branchId={branch.id}>
        <RoutedReportView />
      </BranchReports>,
    );
    await screen.findByLabelText('Page 2/3');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByLabelText('Page 3/3');
    expect(
      new URL(navigationState.href, 'http://localhost').searchParams.get(
        'dailyPage',
      ),
    ).toBe('3');
    act(() => restoreReportUrl(href));
    await screen.findByLabelText('Page 2/3');
    expect(
      request.mock.calls.filter(([path]) => path.includes('/sales/analytics?')),
    ).toHaveLength(1);
  });
  it('does not re-resolve All time simply when navigating between nested tabs', async () => {
    navigationState.href = `/app/organizations/org/branches/${branch.id}/reports/overview?preset=ALL_TIME&fromDay=2026-09-14&throughDay=2026-09-14`;
    const original = request.getMockImplementation()!;
    request.mockImplementation(async (path: string) =>
      path.includes('/sales/period?')
        ? { scope: 'STAFF', branch, ...range, hasActivity: true }
        : original(path),
    );
    render(
      <BranchReports organizationId="org" branchId={branch.id}>
        <RoutedReportView />
      </BranchReports>,
    );
    await screen.findAllByText('PHP 60.00');
    fireEvent.click(screen.getByRole('tab', { name: 'Transactions' }));
    await screen.findByRole('table', { name: 'Transaction history' });
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    await screen.findAllByText('PHP 60.00');
    expect(
      request.mock.calls.filter(([path]) => path.includes('/sales/period?')),
    ).toHaveLength(1);
    expect(
      request.mock.calls.filter(([path]) => path.includes('/sales/analytics?')),
    ).toHaveLength(1);
  });
  it('retains the active tab and period when switching branches and drops branch-specific filters', async () => {
    navigationState.href = `/app/organizations/org/branches/${branch.id}/reports/transactions?preset=CUSTOM&fromDay=2026-09-13&throughDay=2026-09-14&transactionQ=OLD&transactionType=REFUND`;
    render(
      <BranchReports organizationId="org" branchId={branch.id}>
        <RoutedReportView />
      </BranchReports>,
    );
    await screen.findByRole('table', { name: 'Transaction history' });
    fireEvent.click(screen.getByRole('combobox', { name: 'Reports branch' }));
    fireEvent.click(screen.getByRole('option', { name: 'South (MAIN)' }));
    const next = new URL(push.mock.calls.at(-1)![0], 'http://localhost');
    expect(next.pathname).toBe(
      `/app/organizations/org/branches/${second.id}/reports/transactions`,
    );
    expect(Object.fromEntries(next.searchParams)).toEqual({
      preset: 'CUSTOM',
      fromDay: '2026-09-13',
      throughDay: '2026-09-14',
    });
    expect(
      screen.queryByRole('table', { name: 'Transaction history' }),
    ).toBeNull();
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
    expect(
      screen.getByRole('button', { name: 'Report date filter' }),
    ).toHaveTextContent('Sep 14, 2026');
    expect(screen.getAllByText('GCash')).toHaveLength(1);
    expect(screen.getAllByText('Card')).toHaveLength(1);
  });
  it('switches report tabs without leaving the section or changing the applied range', async () => {
    render(<BranchReports organizationId="org" branchId={branch.id} />);
    await screen.findAllByText('PHP 60.00');
    const contextBar = screen.getByRole('region', { name: 'Report context' });
    expect(contextBar).toHaveClass('top-17');
    expect(contextBar).not.toHaveClass('border-y', 'border-b');
    expect(contextBar).not.toHaveTextContent('Sep 14, 2026');
    const tablist = screen.getByRole('tablist', { name: 'Report views' });
    expect(tablist).toHaveClass('pt-2');
    expect(tablist).not.toHaveClass('pb-2');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveClass(
      'min-h-10',
      'border-b',
      'px-2',
    );
    expect(screen.getByRole('tab', { name: 'Overview' })).not.toHaveClass(
      'border-b-2',
    );
    expect(screen.getByRole('button', { name: 'Refresh Report' })).toHaveClass(
      'sm:min-h-10',
      'sm:self-end',
    );
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Daily Data' }));
    expect(
      screen.getByRole('tabpanel', { name: 'Daily Data' }),
    ).toHaveAttribute('id', 'sales-daily-panel');
    expect(
      screen.getByRole('table', { name: 'Daily sales data in Asia/Manila' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Report date filter' }),
    ).toHaveTextContent('Sep 14, 2026');
    fireEvent.click(screen.getByRole('tab', { name: 'Rankings' }));
    expect(
      await screen.findByRole('table', { name: 'Top products by gross sales' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Report date filter' }),
    ).toHaveTextContent('Sep 14, 2026');
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(
      screen.getByRole('heading', { name: 'Daily sales trend' }),
    ).toBeInTheDocument();
  });
  it('loads filtered transaction history with stable source links', async () => {
    render(<BranchReports organizationId="org" branchId={branch.id} />);
    await screen.findAllByText('PHP 60.00');
    fireEvent.click(screen.getByRole('tab', { name: 'Transactions' }));
    expect(
      await screen.findByRole('table', { name: 'Transaction history' }),
    ).toBeInTheDocument();
    expect(
      request.mock.calls.some(([path]) =>
        path.includes('/reports/transactions'),
      ),
    ).toBe(true);
    const transactionTable = screen.getByRole('table', {
      name: 'Transaction history',
    });
    const transactionRow = within(transactionTable).getAllByRole('row')[1];
    expect(
      Array.from(transactionRow.querySelectorAll('td, th')).every((cell) =>
        cell.classList.contains('align-middle'),
      ),
    ).toBe(true);
    const transactionType = transactionRow.querySelectorAll('td, th')[1];
    expect(transactionType?.querySelector('span')).toHaveClass(
      'text-success-ink',
    );
    expect(transactionType?.querySelector('span')).not.toHaveClass(
      'rounded-full',
    );
    expect(
      screen.getByRole('columnheader', { name: 'Action' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View' })).not.toHaveClass(
      'underline',
    );
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute(
      'href',
      `/app/organizations/org/branches/${branch.id}/sales/33333333-3333-4333-8333-333333333333`,
    );
    const transactionHref = `/app/organizations/org/branches/${branch.id}/sales/33333333-3333-4333-8333-333333333333`;
    expect(transactionRow).toHaveAttribute('tabindex', '0');
    fireEvent.click(transactionRow);
    expect(push).toHaveBeenCalledWith(transactionHref);
    push.mockClear();
    fireEvent.keyDown(transactionRow, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith(transactionHref);
    push.mockClear();
    fireEvent.keyDown(transactionRow, { key: ' ' });
    expect(push).toHaveBeenCalledWith(transactionHref);
    expect(screen.getByText('Filter by')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: 'Transaction type' }));
    fireEvent.click(screen.getByRole('option', { name: 'Refunds' }));
    await waitFor(() =>
      expect(
        request.mock.calls.some(
          ([path]) =>
            path.includes('/reports/transactions') &&
            path.includes('type=REFUND'),
        ),
      ).toBe(true),
    );
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search transactions' }),
      {
        target: { value: 'REF-001' },
      },
    );
    await waitFor(() =>
      expect(
        request.mock.calls.some(
          ([path]) =>
            path.includes('/reports/transactions') &&
            path.includes('q=REF-001'),
        ),
      ).toBe(true),
    );
  });
  it('loads staff merchant options on Rankings and requests changed controls', async () => {
    render(<BranchReports organizationId="org" branchId={branch.id} />);
    await screen.findAllByText('PHP 60.00');
    expect(
      request.mock.calls.some(([path]) => path.includes('/merchants')),
    ).toBe(false);
    fireEvent.click(screen.getByRole('tab', { name: 'Rankings' }));
    const merchant = await screen.findByRole('combobox', { name: 'Merchant' });
    await waitFor(() => expect(merchant).toBeEnabled());
    expect(
      request.mock.calls.some(([path]) => path.includes('/merchants')),
    ).toBe(true);
    fireEvent.click(screen.getByRole('combobox', { name: 'Rank by' }));
    fireEvent.click(screen.getByRole('option', { name: 'Units sold' }));
    await waitFor(() =>
      expect(
        request.mock.calls.some(
          ([path]) =>
            path.includes('/rankings') && path.includes('sortBy=UNITS_SOLD'),
        ),
      ).toBe(true),
    );
    fireEvent.click(merchant);
    fireEvent.click(screen.getByRole('option', { name: 'Local maker' }));
    await waitFor(() =>
      expect(
        request.mock.calls.some(
          ([path]) =>
            path.includes('/rankings') &&
            path.includes('merchantId=44444444-4444-4444-8444-444444444444'),
        ),
      ).toBe(true),
    );
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
  it('does not read while selecting and reads only on Apply', async () => {
    render(<BranchReports organizationId="org" branchId={branch.id} />);
    await screen.findAllByText('PHP 60.00');
    chooseReportDates('2026-09-13');
    expect(
      screen.getByRole('button', { name: 'Refresh Report' }),
    ).toBeEnabled();
    expect(request).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Report' }));
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
    chooseReportDates('2026-09-13');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
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
    expect(screen.queryByText(/Applied period/)).not.toBeInTheDocument();
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
  it('applies a bounded preset immediately through the custom dropdown', async () => {
    render(<BranchReports organizationId="org" branchId={branch.id} />);
    await screen.findAllByText('PHP 60.00');
    fireEvent.click(screen.getByRole('combobox', { name: 'Period' }));
    fireEvent.click(screen.getByRole('option', { name: 'This month' }));
    await screen.findAllByText('PHP 60.00');
    expect(request.mock.calls.at(-1)?.[0]).toContain(
      new URLSearchParams({
        from: '2026-08-31T16:00:00.000Z',
        until: range.until,
      }).toString(),
    );
    expect(
      screen.queryByRole('button', { name: 'Apply period' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Report date filter' }),
    ).toBeInTheDocument();
  });
  it('applies All time immediately and freezes bounds on refresh', async () => {
    render(<BranchReports organizationId="org" branchId={branch.id} />);
    await screen.findAllByText('PHP 60.00');
    const original = request.getMockImplementation()!;
    request.mockImplementation(async (path: string) =>
      path.includes('/sales/period?')
        ? { scope: 'STAFF', branch, ...range, hasActivity: true }
        : original(path),
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Period' }));
    fireEvent.click(screen.getByRole('option', { name: 'All time' }));
    expect(
      screen.queryByRole('button', { name: 'Apply period' }),
    ).not.toBeInTheDocument();
    await screen.findAllByText('PHP 60.00');
    expect(
      request.mock.calls.filter(([path]) => path.includes('/sales/period?')),
    ).toHaveLength(1);
    expect(
      new URL(navigationState.href, 'http://localhost').searchParams.get(
        'preset',
      ),
    ).toBe('ALL_TIME');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Report' }));
    await screen.findAllByText('PHP 60.00');
    expect(
      request.mock.calls.filter(([path]) => path.includes('/sales/period?')),
    ).toHaveLength(1);
  });
  it('shows an explicit empty All time without inventing an activity start', async () => {
    render(<BranchReports organizationId="org" branchId={branch.id} />);
    await screen.findAllByText('PHP 60.00');
    request.mockResolvedValueOnce([branch, second]).mockResolvedValueOnce({
      scope: 'STAFF',
      branch,
      from: null,
      until: range.until,
      hasActivity: false,
    });
    fireEvent.click(screen.getByRole('combobox', { name: 'Period' }));
    fireEvent.click(screen.getByRole('option', { name: 'All time' }));
    await screen.findByText('No completed sales or refunds yet.');
    expect(
      screen.getByRole('button', { name: 'Report date filter' }),
    ).toHaveTextContent('Sep 14, 2026');
    expect(screen.queryByText('PHP 60.00')).not.toBeInTheDocument();
  });
  it('preserves All time and resolves activity again for a different branch', async () => {
    const original = request.getMockImplementation()!;
    request.mockImplementation(async (path: string) =>
      path.includes('/sales/period?')
        ? {
            scope: 'STAFF',
            branch: path.includes(second.id) ? second : branch,
            ...range,
            hasActivity: true,
          }
        : original(path),
    );
    const view = render(
      <BranchReports organizationId="org" branchId={branch.id} />,
    );
    await screen.findAllByText('PHP 60.00');
    fireEvent.click(screen.getByRole('combobox', { name: 'Period' }));
    fireEvent.click(screen.getByRole('option', { name: 'All time' }));
    await screen.findAllByText('PHP 60.00');
    view.rerender(<BranchReports organizationId="org" branchId={second.id} />);
    expect(screen.queryByText('PHP 60.00')).not.toBeInTheDocument();
    await screen.findAllByText('PHP 60.00');
    expect(screen.getByRole('combobox', { name: 'Period' })).toHaveTextContent(
      'All time',
    );
    expect(
      request.mock.calls.filter(([path]) => path.includes('/sales/period?')),
    ).toHaveLength(2);
  });
  it('preserves the date period and clears scoped data on a branch route change', async () => {
    const view = render(
      <BranchReports organizationId="org" branchId={branch.id} />,
    );
    await screen.findAllByText('PHP 60.00');
    chooseReportDates('2026-09-13');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await screen.findAllByText('PHP 60.00');
    view.rerender(<BranchReports organizationId="org" branchId={second.id} />);
    expect(screen.queryByText('PHP 60.00')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Report date filter' }),
    ).toHaveTextContent('Sep 13, 2026');
    await screen.findAllByText('PHP 60.00');
    expect(request.mock.calls.at(-1)?.[0]).toContain(
      `/branches/${second.id}/reports/sales/analytics?${new URLSearchParams({ from: '2026-09-12T16:00:00.000Z', until: '2026-09-13T16:00:00.000Z' })}`,
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
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Report' }));
    await screen.findByRole('alert');
    expect(screen.queryByText('PHP 60.00')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: 'Payment breakdown' }),
    ).not.toBeInTheDocument();
  });
  it('clears totals before branch navigation without a back button', async () => {
    render(<BranchReports organizationId="org" branchId={branch.id} />);
    await screen.findAllByText('PHP 60.00');
    fireEvent.click(screen.getByRole('combobox', { name: 'Reports branch' }));
    fireEvent.click(screen.getByRole('option', { name: 'South (MAIN)' }));
    expect(screen.queryByText('PHP 60.00')).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledWith(
      `/app/organizations/org/branches/${second.id}/reports/overview?${new URLSearchParams({ preset: 'TODAY', fromDay: '2026-09-14', throughDay: '2026-09-14' })}`,
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
    it('revalidates All time on merchant refresh so a changed link cannot truncate history', async () => {
      const original = request.getMockImplementation()!;
      let from = range.from;
      request.mockImplementation(async (path: string) =>
        path.includes('/sales/period?')
          ? {
              scope: 'MERCHANT',
              branch,
              from,
              until: range.until,
              hasActivity: true,
            }
          : original(path),
      );
      render(<BranchReports organizationId="org" branchId={branch.id} />);
      await screen.findAllByText('PHP 25.00');
      fireEvent.click(screen.getByRole('combobox', { name: 'Period' }));
      fireEvent.click(screen.getByRole('option', { name: 'All time' }));
      await screen.findAllByText('PHP 25.00');
      from = '2026-09-12T16:00:00.000Z';
      fireEvent.click(screen.getByRole('button', { name: 'Refresh Report' }));
      await screen.findAllByText('PHP 25.00');
      expect(
        screen.getByRole('button', { name: 'Report date filter' }),
      ).toHaveTextContent('Sep 13, 2026');
      expect(
        request.mock.calls.filter(([path]) => path.includes('/sales/period?')),
      ).toHaveLength(2);
      expect(request.mock.calls.at(-1)?.[0]).toContain(
        new URLSearchParams({ from, until: range.until }).toString(),
      );
    });
    it('shows own amounts only, without payment/whole-sale/actor data or mutation/print controls', async () => {
      render(<BranchReports organizationId="org" branchId={branch.id} />);
      await screen.findAllByText('PHP 25.00');
      expect(
        screen.getByRole('heading', { name: 'Own-sales reports' }),
      ).toBeInTheDocument();
      expect(screen.getAllByText('Transactions with own items')).toHaveLength(
        1,
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
      fireEvent.click(screen.getByRole('combobox', { name: 'Reports branch' }));
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
      await screen.findByText(/If your profile is not linked/);
      chooseReportDates('2026-09-13');
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      await screen.findAllByText('PHP 0.00');
      fireEvent.click(screen.getByRole('combobox', { name: 'Reports branch' }));
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
        fireEvent.click(screen.getByRole('button', { name: 'Refresh Report' }));
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
      fireEvent.click(screen.getByRole('button', { name: 'Refresh Report' }));
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
      chooseReportDates('2026-09-13');
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
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
