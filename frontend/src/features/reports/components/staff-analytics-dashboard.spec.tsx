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
});

describe('staff analytics dashboard', () => {
  it('renders the dashboard hierarchy, negative net and saved top-product data', () => {
    render(<StaffAnalyticsDashboard report={report} />);
    expect(
      screen.getByRole('heading', { name: 'Gross sales and refunds' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Net recorded sales' }),
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
});
