import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ApiError } from '@/features/auth/api/auth-client';
import { getReportDailyPage } from '../api/report-api';
import type {
  MerchantDailyReportPage,
  StaffDailyReportPage,
} from '../model/report.schemas';
import type { ReportScope } from '../model/report-scope';
import { DailyDataTab } from './daily-data-tab';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/features/auth/model/auth-context', () => ({
  useAuth: () => ({ request }),
}));
vi.mock('../api/report-api', () => ({ getReportDailyPage: vi.fn() }));

const props = {
  organizationId: '11111111-1111-4111-8111-111111111111',
  branchId: '22222222-2222-4222-8222-222222222222',
  from: '2023-12-31T16:00:00.000Z',
  until: '2024-01-30T16:00:00.000Z',
  merchant: false,
};
const branchScope: ReportScope = {
  kind: 'branch',
  branchId: props.branchId,
};

function staffPage(page = 1): StaffDailyReportPage {
  return {
    scope: 'STAFF',
    branch: { id: props.branchId, name: 'Main', code: null },
    from: props.from,
    until: props.until,
    page,
    limit: 15,
    total: 30,
    totalPages: 2,
    items: Array.from({ length: 15 }, (_, index) => ({
      date: `2024-01-${String((page - 1) * 15 + index + 1).padStart(2, '0')}`,
      grossSales: '0.00',
      transactionCount: '0',
      unitsSold: '0',
      refundedAmount: '0.00',
      refundCount: '0',
      returnedUnits: '0',
      netRecordedSales: '0.00',
    })),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.mocked(getReportDailyPage).mockReset();
});

it('requests fifteen server rows per page and clears old rows while navigating forward and back', async () => {
  const next = deferred<StaffDailyReportPage>();
  vi.mocked(getReportDailyPage)
    .mockResolvedValueOnce(staffPage())
    .mockReturnValueOnce(next.promise)
    .mockResolvedValueOnce(staffPage());
  render(<DailyDataTab {...props} />);
  expect(
    screen.getByRole('status', { name: 'Loading daily data' }),
  ).toBeInTheDocument();
  const table = await screen.findByRole('table', {
    name: 'Daily sales data in Asia/Manila',
  });
  expect(within(table).getAllByRole('row')).toHaveLength(16);
  expect(screen.getByText('2024-01-15')).toBeInTheDocument();
  expect(getReportDailyPage).toHaveBeenNthCalledWith(
    1,
    request,
    props.organizationId,
    branchScope,
    { from: props.from, until: props.until, page: 1, limit: 15 },
    false,
  );
  const navigation = screen.getByRole('navigation', {
    name: 'Daily data pagination',
  });
  expect(
    within(navigation).getByRole('button', { name: 'Previous' }),
  ).toBeDisabled();
  expect(within(navigation).getByText(/30 days/)).toBeInTheDocument();
  fireEvent.click(within(navigation).getByRole('button', { name: 'Next' }));
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByText('2024-01-01')).not.toBeInTheDocument();
  expect(
    screen.getByRole('status', { name: 'Loading daily data' }),
  ).toBeInTheDocument();
  expect(getReportDailyPage).toHaveBeenNthCalledWith(
    2,
    request,
    props.organizationId,
    branchScope,
    { from: props.from, until: props.until, page: 2, limit: 15 },
    false,
  );
  await act(async () => next.resolve(staffPage(2)));
  expect(screen.getByText('2024-01-16')).toBeInTheDocument();
  expect(screen.getByText('2024-01-30')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(screen.getByLabelText('Page 2/2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  await screen.findByText('2024-01-01');
  expect(getReportDailyPage).toHaveBeenNthCalledWith(
    3,
    request,
    props.organizationId,
    branchScope,
    { from: props.from, until: props.until, page: 1, limit: 15 },
    false,
  );
  expect(screen.queryByText('2024-01-16')).not.toBeInTheDocument();
});

it.each([
  {
    cause: new Error('Private network failure'),
    message: 'Daily data could not be loaded.',
  },
  {
    cause: new ApiError(403, 'Report access was removed.'),
    message: 'Report access was removed.',
  },
])(
  'retries the failed server page without showing old rows: $message',
  async ({ cause, message }) => {
    const retry = deferred<StaffDailyReportPage>();
    vi.mocked(getReportDailyPage)
      .mockResolvedValueOnce(staffPage())
      .mockRejectedValueOnce(cause)
      .mockReturnValueOnce(retry.promise);
    render(<DailyDataTab {...props} />);
    await screen.findByText('2024-01-01');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText(message);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('2024-01-01')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading daily data' }),
    ).toBeInTheDocument();
    expect(getReportDailyPage).toHaveBeenNthCalledWith(
      3,
      request,
      props.organizationId,
      branchScope,
      { from: props.from, until: props.until, page: 2, limit: 15 },
      false,
    );
    await act(async () => retry.resolve(staffPage(2)));
    await screen.findByText('2024-01-16');
    expect(screen.queryByText('2024-01-01')).not.toBeInTheDocument();
  },
);

it.each(['resolve', 'reject'] as const)(
  'ignores a stale request after unmount when it will %s',
  async (outcome) => {
    const stale = deferred<StaffDailyReportPage>();
    const current = deferred<StaffDailyReportPage>();
    vi.mocked(getReportDailyPage)
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(current.promise);
    const first = render(<DailyDataTab {...props} />);
    first.unmount();
    render(<DailyDataTab {...props} />);
    await act(async () => {
      if (outcome === 'resolve') stale.resolve(staffPage());
      else stale.reject(new Error('Old request failed'));
    });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Daily data could not be loaded.'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading daily data' }),
    ).toBeInTheDocument();
    await act(async () => current.resolve(staffPage(2)));
    expect(screen.getByText('2024-01-16')).toBeInTheDocument();
    expect(screen.queryByText('2024-01-01')).not.toBeInTheDocument();
  },
);

it('discards a pending old-branch response while a new branch request is loading', async () => {
  const stale = deferred<StaffDailyReportPage>();
  const current = deferred<StaffDailyReportPage>();
  const branchId = '33333333-3333-4333-8333-333333333333';
  vi.mocked(getReportDailyPage)
    .mockReturnValueOnce(stale.promise)
    .mockReturnValueOnce(current.promise);
  const { rerender } = render(<DailyDataTab {...props} />);
  rerender(<DailyDataTab {...props} branchId={branchId} />);
  await act(async () => stale.resolve(staffPage()));
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(
    screen.getByRole('status', { name: 'Loading daily data' }),
  ).toBeInTheDocument();
  expect(getReportDailyPage).toHaveBeenLastCalledWith(
    request,
    props.organizationId,
    { kind: 'branch', branchId },
    { from: props.from, until: props.until, page: 1, limit: 15 },
    false,
  );
  await act(async () =>
    current.resolve({
      ...staffPage(2),
      branch: { id: branchId, name: 'South', code: null },
    }),
  );
  expect(screen.getByText('2024-01-16')).toBeInTheDocument();
  expect(screen.queryByText('2024-01-01')).not.toBeInTheDocument();
});

it('requests the merchant projection and renders only own-sales columns', async () => {
  const page: MerchantDailyReportPage = {
    ...staffPage(),
    scope: 'MERCHANT',
    items: staffPage().items.map((row, index) => ({
      date: row.date,
      ownGrossSales: index === 1 ? '7.00' : '0.00',
      ownTransactionCount: index === 1 ? '1' : '0',
      ownUnitsSold: index === 1 ? '1' : '0',
      ownRefundedAmount: index ? '0.00' : '7.00',
      ownRefundCount: index ? '0' : '1',
      ownReturnedUnits: index ? '0' : '1',
      ownNetRecordedSales:
        index === 0 ? '-7.00' : index === 1 ? '7.00' : '0.00',
    })),
  };
  vi.mocked(getReportDailyPage).mockResolvedValueOnce(page);
  render(<DailyDataTab {...props} merchant />);
  const table = await screen.findByRole('table', {
    name: 'Daily own-sales data in Asia/Manila',
  });
  expect(within(table).getAllByRole('row')).toHaveLength(16);
  expect(
    within(table).getByRole('columnheader', { name: 'Own gross' }),
  ).toBeInTheDocument();
  expect(
    within(table).getByRole('columnheader', {
      name: 'Transactions with own items',
    }),
  ).toBeInTheDocument();
  const rows = within(table).getAllByRole('row').slice(1);
  for (const [index, amount, tone] of [
    [0, '-7.00', 'text-danger'],
    [1, '+7.00', 'text-success-ink'],
    [2, '0.00', 'text-ink'],
  ] as const) {
    const cells = within(rows[index]).getAllByRole('cell');
    expect(cells.at(-1)?.textContent).toBe(amount);
    expect(cells.at(-1)).toHaveClass(tone);
    for (const cell of cells) expect(cell).not.toHaveTextContent('PHP');
  }
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent),
  ).toEqual([
    'Date',
    'Own gross',
    'Transactions with own items',
    'Own units sold',
    'Own refunded',
    'Matching refunds',
    'Own returned units',
    'Own net recorded',
  ]);
  expect(
    within(table).queryByRole('columnheader', { name: 'Gross sales' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('table', { name: 'Daily sales data in Asia/Manila' }),
  ).not.toBeInTheDocument();
  expect(getReportDailyPage).toHaveBeenCalledWith(
    request,
    props.organizationId,
    branchScope,
    { from: props.from, until: props.until, page: 1, limit: 15 },
    true,
  );
});
