import { fireEvent, render, screen, within } from '@testing-library/react';
import { StaffAnalyticsDashboard } from './staff-analytics-dashboard';
import { staffSalesAnalyticsSchema } from '../model/report.schemas';

const report = staffSalesAnalyticsSchema.parse({
  scope: 'STAFF',
  branch: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Main',
    code: null,
  },
  from: '2026-09-13T16:00:00.000Z',
  until: '2026-09-15T16:00:00.000Z',
  grossSales: '5.00',
  transactionCount: '1',
  unitsSold: '1',
  refundedAmount: '10.00',
  refundCount: '1',
  returnedUnits: '1',
  netRecordedSales: '-5.00',
  payments: [
    { paymentMethod: 'CASH', grossSales: '5.00', transactionCount: '1' },
    { paymentMethod: 'GCASH', grossSales: '0.00', transactionCount: '0' },
    { paymentMethod: 'CARD', grossSales: '0.00', transactionCount: '0' },
  ],
  refundMethods: [
    { paymentMethod: 'CASH', refundedAmount: '0.00', refundCount: '0' },
    { paymentMethod: 'GCASH', refundedAmount: '10.00', refundCount: '1' },
    { paymentMethod: 'CARD', refundedAmount: '0.00', refundCount: '0' },
  ],
  netByPaymentMethod: [
    { paymentMethod: 'CASH', netRecordedSales: '-5.00' },
    { paymentMethod: 'GCASH', netRecordedSales: '0.00' },
    { paymentMethod: 'CARD', netRecordedSales: '0.00' },
  ],
  dailyTrends: [
    {
      date: '2026-09-14',
      grossSales: '5.00',
      transactionCount: '1',
      unitsSold: '1',
      refundedAmount: '0.00',
      refundCount: '0',
      returnedUnits: '0',
      netRecordedSales: '5.00',
    },
    {
      date: '2026-09-15',
      grossSales: '0.00',
      transactionCount: '0',
      unitsSold: '0',
      refundedAmount: '10.00',
      refundCount: '1',
      returnedUnits: '1',
      netRecordedSales: '-10.00',
    },
  ],
  topProducts: [
    {
      productId: '22222222-2222-4222-8222-222222222222',
      productName: 'Sold item with a saved identity',
      sku: null,
      barcode: null,
      merchantName: 'Merchant one',
      grossSales: '5.00',
      unitsSold: '1',
      refundedAmount: '0.00',
      returnedUnits: '0',
      netRecordedSales: '5.00',
    },
    {
      productId: '33333333-3333-4333-8333-333333333333',
      productName: 'Refund only',
      sku: null,
      barcode: '987',
      merchantName: 'Merchant two',
      grossSales: '0.00',
      unitsSold: '0',
      refundedAmount: '10.00',
      returnedUnits: '1',
      netRecordedSales: '-10.00',
    },
  ],
  totalProducts: '2',
  topMerchants: [
    {
      merchantId: '44444444-4444-4444-8444-444444444444',
      merchantName: 'Merchant one',
      grossSales: '5.00',
    },
  ],
});

function grossOnlyReport({
  dates,
  salesByDate,
  from,
  until,
}: {
  dates: string[];
  salesByDate: Record<string, string>;
  from: string;
  until: string;
}) {
  const dailyTrends = dates.map((date) => {
    const grossSales = salesByDate[date] ?? '0.00';
    const hasSale = grossSales !== '0.00';
    return {
      date,
      grossSales,
      transactionCount: hasSale ? '1' : '0',
      unitsSold: hasSale ? '1' : '0',
      refundedAmount: '0.00',
      refundCount: '0',
      returnedUnits: '0',
      netRecordedSales: grossSales,
    };
  });
  const totalCents = dailyTrends.reduce(
    (total, row) => total + BigInt(row.grossSales.replace('.', '')),
    BigInt(0),
  );
  const grossSales = `${totalCents / BigInt(100)}.${(totalCents % BigInt(100))
    .toString()
    .padStart(2, '0')}`;
  const transactionCount = dailyTrends.filter(
    (row) => row.transactionCount === '1',
  ).length;
  const hasSales = totalCents > BigInt(0);
  const topProducts = hasSales
    ? [
        {
          ...report.topProducts[0],
          grossSales,
          unitsSold: String(transactionCount),
          refundedAmount: '0.00',
          returnedUnits: '0',
          netRecordedSales: grossSales,
        },
      ]
    : [];
  const topMerchants = hasSales
    ? [{ ...report.topMerchants[0], grossSales }]
    : [];

  return staffSalesAnalyticsSchema.parse({
    ...report,
    from,
    until,
    grossSales,
    transactionCount: String(transactionCount),
    unitsSold: String(transactionCount),
    refundedAmount: '0.00',
    refundCount: '0',
    returnedUnits: '0',
    netRecordedSales: grossSales,
    payments: [
      {
        paymentMethod: 'CASH',
        grossSales,
        transactionCount: String(transactionCount),
      },
      { paymentMethod: 'GCASH', grossSales: '0.00', transactionCount: '0' },
      { paymentMethod: 'CARD', grossSales: '0.00', transactionCount: '0' },
    ],
    refundMethods: report.refundMethods.map((row) => ({
      ...row,
      refundedAmount: '0.00',
      refundCount: '0',
    })),
    netByPaymentMethod: report.netByPaymentMethod.map((row) => ({
      ...row,
      netRecordedSales: row.paymentMethod === 'CASH' ? grossSales : '0.00',
    })),
    dailyTrends,
    topProducts,
    totalProducts: hasSales ? '1' : '0',
    topMerchants,
  });
}

describe('staff analytics dashboard', () => {
  it('renders the dashboard hierarchy, negative net and saved top-product data', () => {
    render(<StaffAnalyticsDashboard report={report} />);
    expect(
      screen.getByRole('heading', { name: 'Daily sales trend' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Top 2 of 2 contributing products. Saved sale identity; not current inventory or pricing.',
      ),
    ).toBeInTheDocument();
    const products = screen.getByRole('table', { name: /Top products/i });
    expect(within(products).getByText('Refund only')).toBeInTheDocument();
    expect(within(products).getByText('PHP -10.00')).toBeInTheDocument();
    expect(
      screen.queryByText(/profit margin|visitor|in stock/i),
    ).not.toBeInTheDocument();
  });
  it('keeps exact daily values in a labeled table while decorative charts stay hidden', () => {
    const { container } = render(<StaffAnalyticsDashboard report={report} />);
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(
      2,
    );
    fireEvent.click(screen.getByText('View exact daily data'));
    const daily = screen.getByRole('table', {
      name: 'Exact daily sales analytics in Asia/Manila',
    });
    expect(within(daily).getByText('2026-09-15')).toBeInTheDocument();
    expect(within(daily).getByText('PHP -10.00')).toBeInTheDocument();
    expect(screen.getByText('View exact daily data')).toBeInTheDocument();
  });
  it('switches between accessible metrics and follows the applied daily report range', () => {
    render(<StaffAnalyticsDashboard report={report} />);
    const metricGroup = screen.getByRole('group', {
      name: 'Sales trend metric',
    });
    const netSales = within(metricGroup).getByRole('radio', {
      name: 'Net Sales',
    });
    expect(netSales).toBeChecked();
    expect(netSales.closest('label')).toHaveClass('rounded-full');
    const netValues = screen.getByRole('list', {
      name: 'Net Sales exact daily values',
    });
    expect(
      within(netValues).getByText('2026-09-14: PHP 5.00'),
    ).toBeInTheDocument();
    expect(
      within(netValues).getByText('2026-09-15: PHP -10.00'),
    ).toBeInTheDocument();

    fireEvent.click(
      within(metricGroup).getByRole('radio', { name: 'Gross Sales' }),
    );
    expect(
      within(
        screen.getByRole('group', { name: 'Sales trend metric' }),
      ).getByRole('radio', { name: 'Gross Sales' }),
    ).toBeChecked();
    const grossValues = screen.getByRole('list', {
      name: 'Gross Sales exact daily values',
    });
    expect(
      within(grossValues).getByText('2026-09-14: PHP 5.00'),
    ).toBeInTheDocument();
    expect(
      within(grossValues).getByText('2026-09-15: PHP 0.00'),
    ).toBeInTheDocument();

    fireEvent.click(
      within(metricGroup).getByRole('radio', { name: 'Refunds' }),
    );
    const refundValues = screen.getByRole('list', {
      name: 'Refunds exact daily values',
    });
    expect(
      within(refundValues).getByText('2026-09-15: PHP 10.00'),
    ).toBeInTheDocument();
    expect(
      within(refundValues).getByText('2026-09-14: PHP 0.00'),
    ).toBeInTheDocument();
  });

  it('shows top-five performance bars, gross payment values and responsive chart proportions', () => {
    const topProducts = Array.from({ length: 6 }, (_, index) => ({
      ...report.topProducts[0],
      productId: `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      productName: `Product ${index + 1}`,
      grossSales: '0.50',
      refundedAmount: '0.00',
      returnedUnits: '0',
      netRecordedSales: '0.50',
    }));
    const merchantAmounts = ['1.00', '0.90', '0.85', '0.80', '0.75', '0.70'];
    const topMerchants = merchantAmounts.map((grossSales, index) => ({
      merchantId: `60000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      merchantName: `Merchant ${index + 1}`,
      grossSales,
    }));
    const ranked = staffSalesAnalyticsSchema.parse({
      ...report,
      topProducts,
      totalProducts: '6',
      topMerchants,
    });
    render(<StaffAnalyticsDashboard report={ranked} />);

    const performance = screen.getByRole('group', {
      name: 'Performance charts',
    });
    expect(performance).toHaveClass('md:grid-cols-2');
    const merchants = screen.getByRole('list', {
      name: 'Top merchants by gross sales values',
    });
    expect(within(merchants).getAllByRole('listitem')).toHaveLength(5);
    expect(within(merchants).getByText('Merchant 1')).toBeInTheDocument();
    expect(within(merchants).queryByText('Merchant 6')).not.toBeInTheDocument();
    expect(merchants.closest('section')).toBeInTheDocument();
    const productsBySales = screen.getByRole('list', {
      name: 'Top products by gross sales values',
    });
    expect(within(productsBySales).getAllByRole('listitem')).toHaveLength(5);
    expect(within(productsBySales).getByText('Product 1')).toBeInTheDocument();
    expect(
      within(productsBySales).queryByText('Product 6'),
    ).not.toBeInTheDocument();
    expect(productsBySales.closest('section')).toBeInTheDocument();

    const weekdayRow = screen.getByRole('group', {
      name: 'Weekday and payment method charts',
    });
    expect(weekdayRow).toHaveClass('md:grid-cols-3');
    expect(weekdayRow.children[0]).toHaveClass('md:col-span-2');
    expect(weekdayRow.children[1]).toHaveClass('md:col-span-1');
    expect(
      screen.getByRole('heading', { name: 'Average sales by weekday' }),
    ).toBeInTheDocument();
    const paymentChart = screen
      .getByRole('heading', { name: 'Gross sales by payment method' })
      .closest('section');
    expect(within(paymentChart!).getByText('Cash')).toBeInTheDocument();
    expect(within(paymentChart!).getByText('PHP 5.00')).toBeInTheDocument();
    expect(
      within(paymentChart!).getByText('1 transactions'),
    ).toBeInTheDocument();
    expect(within(paymentChart!).getByText('GCash')).toBeInTheDocument();
    expect(within(paymentChart!).getByText('Card')).toBeInTheDocument();
    const productTable = screen.getByRole('table', {
      name: 'Top products by gross sales',
    });
    expect(within(productTable).getAllByRole('row')).toHaveLength(7);
  });

  it('averages gross sales over every weekday date in partial weeks and rounds half cents up', () => {
    const dates = Array.from({ length: 8 }, (_, index) =>
      new Date(Date.UTC(2026, 8, 14 + index)).toISOString().slice(0, 10),
    );
    const partialWeeks = grossOnlyReport({
      dates,
      salesByDate: { '2026-09-14': '0.05' },
      from: '2026-09-13T16:00:00.000Z',
      until: '2026-09-21T16:00:00.000Z',
    });
    render(<StaffAnalyticsDashboard report={partialWeeks} />);
    const trend = screen
      .getByRole('heading', { name: 'Daily sales trend' })
      .closest('section');
    expect(
      trend?.querySelector('polyline')?.getAttribute('points')?.split(' '),
    ).toHaveLength(7);
    const weekdayValues = screen.getByRole('list', {
      name: 'Average gross sales by weekday values',
    });
    expect(
      within(weekdayValues).getByRole('listitem', {
        name: 'Monday: PHP 0.03 average across 2 dates',
      }),
    ).toBeInTheDocument();
    expect(
      within(weekdayValues).getByRole('listitem', {
        name: 'Tuesday: PHP 0.00 average across 1 date',
      }),
    ).toBeInTheDocument();
  });

  it('labels weekdays absent from a one-day range without dividing by zero', () => {
    const oneDay = grossOnlyReport({
      dates: ['2026-09-14'],
      salesByDate: { '2026-09-14': '5.00' },
      from: '2026-09-13T16:00:00.000Z',
      until: '2026-09-14T16:00:00.000Z',
    });
    render(<StaffAnalyticsDashboard report={oneDay} />);
    const weekdayValues = screen.getByRole('list', {
      name: 'Average gross sales by weekday values',
    });
    expect(
      within(weekdayValues).getByRole('listitem', {
        name: 'Monday: PHP 5.00 average across 1 date',
      }),
    ).toBeInTheDocument();
    expect(
      within(weekdayValues).getByRole('listitem', {
        name: 'Tuesday: No dates in this period',
      }),
    ).toBeInTheDocument();
    expect(within(weekdayValues).getAllByText('No dates')).toHaveLength(6);
  });

  it('uses hourly points for a one-day period while keeping the axis readable', () => {
    const oneDay = grossOnlyReport({
      dates: ['2026-09-14'],
      salesByDate: { '2026-09-14': '5.00' },
      from: '2026-09-13T16:00:00.000Z',
      until: '2026-09-14T16:00:00.000Z',
    });
    const hourlyTrends = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      grossSales: hour === 9 ? '5.00' : '0.00',
      transactionCount: hour === 9 ? '1' : '0',
      unitsSold: hour === 9 ? '1' : '0',
      refundedAmount: '0.00',
      refundCount: '0',
      returnedUnits: '0',
      netRecordedSales: hour === 9 ? '5.00' : '0.00',
    }));
    const hourlyReport = staffSalesAnalyticsSchema.parse({
      ...oneDay,
      hourlyTrends,
    });
    render(<StaffAnalyticsDashboard report={hourlyReport} />);
    expect(
      screen.getByText(/Net Sales by Philippine hour/),
    ).toBeInTheDocument();
    const trend = screen
      .getByRole('heading', { name: 'Hourly sales trend' })
      .closest('section');
    expect(trend?.querySelectorAll('circle')).toHaveLength(7);
    expect(screen.getByText('12 AM')).toBeInTheDocument();
    expect(screen.getByText('12 PM')).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('list', { name: 'Net Sales exact hourly values' }),
      ).getByText('9 AM: PHP 5.00'),
    ).toBeInTheDocument();
  });

  it('keeps a one-cent negative net value signed in the selectable line chart', () => {
    const tinyNet = staffSalesAnalyticsSchema.parse({
      ...report,
      grossSales: '10.00',
      transactionCount: '1',
      unitsSold: '1',
      refundedAmount: '10.01',
      netRecordedSales: '-0.01',
      payments: report.payments.map((row) =>
        row.paymentMethod === 'CASH'
          ? { ...row, grossSales: '10.00', transactionCount: '1' }
          : { ...row, grossSales: '0.00', transactionCount: '0' },
      ),
      refundMethods: report.refundMethods.map((row) =>
        row.paymentMethod === 'CARD'
          ? { ...row, refundedAmount: '10.01', refundCount: '1' }
          : { ...row, refundedAmount: '0.00', refundCount: '0' },
      ),
      netByPaymentMethod: report.netByPaymentMethod.map((row) =>
        row.paymentMethod === 'CASH'
          ? { ...row, netRecordedSales: '-0.01' }
          : { ...row, netRecordedSales: '0.00' },
      ),
      dailyTrends: report.dailyTrends.map((row) => ({
        ...row,
        grossSales: row.date === '2026-09-15' ? '10.00' : '0.00',
        transactionCount: row.date === '2026-09-15' ? '1' : '0',
        unitsSold: row.date === '2026-09-15' ? '1' : '0',
        refundedAmount: row.date === '2026-09-15' ? '10.01' : '0.00',
        refundCount: row.date === '2026-09-15' ? '1' : '0',
        returnedUnits: row.date === '2026-09-15' ? '1' : '0',
        netRecordedSales: row.date === '2026-09-15' ? '-0.01' : '0.00',
      })),
      topProducts: [
        {
          ...report.topProducts[0],
          grossSales: '10.00',
          unitsSold: '1',
          netRecordedSales: '10.00',
        },
        report.topProducts[1],
      ],
      topMerchants: report.topMerchants.map((row) => ({
        ...row,
        grossSales: '10.00',
      })),
    });
    render(<StaffAnalyticsDashboard report={tinyNet} />);
    const netValues = screen.getByRole('list', {
      name: 'Net Sales exact daily values',
    });
    expect(
      within(netValues).getByText('2026-09-15: PHP -0.01'),
    ).toBeInTheDocument();
    const trend = screen
      .getByRole('heading', { name: 'Daily sales trend' })
      .closest('section');
    const svg = trend?.querySelector('svg');
    const baseline = Number(svg?.querySelector('line')?.getAttribute('y1'));
    const negativeY = Number(
      svg?.querySelector('circle:last-of-type')?.getAttribute('cy'),
    );
    expect(negativeY).toBeGreaterThan(baseline);
  });
  it('shows explicit empty states for zero gross, refunds and net values', () => {
    const emptyReport = staffSalesAnalyticsSchema.parse({
      ...report,
      grossSales: '0.00',
      transactionCount: '0',
      unitsSold: '0',
      payments: report.payments.map((row) => ({
        ...row,
        grossSales: '0.00',
        transactionCount: '0',
      })),
      refundedAmount: '0.00',
      refundCount: '0',
      returnedUnits: '0',
      netRecordedSales: '0.00',
      refundMethods: report.refundMethods.map((row) => ({
        ...row,
        refundedAmount: '0.00',
        refundCount: '0',
      })),
      netByPaymentMethod: report.netByPaymentMethod.map((row) => ({
        ...row,
        netRecordedSales: '0.00',
      })),
      dailyTrends: report.dailyTrends.map((row) => ({
        ...row,
        grossSales: '0.00',
        transactionCount: '0',
        unitsSold: '0',
        refundedAmount: '0.00',
        refundCount: '0',
        returnedUnits: '0',
        netRecordedSales: '0.00',
      })),
      topProducts: [],
      totalProducts: '0',
      topMerchants: [],
    });
    render(<StaffAnalyticsDashboard report={emptyReport} />);
    expect(
      screen.getByText('No gross sales by payment method in this period.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Net sales are zero on every date in this period.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No gross sales in this period.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No merchant gross sales in this period.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No product gross sales in this period.'),
    ).toBeInTheDocument();
  });
});
