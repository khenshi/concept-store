import { render, screen, within } from '@testing-library/react';
import { merchantSalesAnalyticsSchema } from '../model/report.schemas';
import { MerchantAnalyticsDashboard } from './merchant-analytics-dashboard';

const report = merchantSalesAnalyticsSchema.parse({
  scope: 'MERCHANT',
  branch: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Main',
    code: null,
  },
  from: '2026-09-13T16:00:00.000Z',
  until: '2026-09-14T16:00:00.000Z',
  ownGrossSales: '0.00',
  ownTransactionCount: '0',
  ownUnitsSold: '0',
  ownRefundedAmount: '8.00',
  ownRefundCount: '1',
  ownReturnedUnits: '1',
  ownNetRecordedSales: '-8.00',
  dailyTrends: [
    {
      date: '2026-09-14',
      ownGrossSales: '0.00',
      ownTransactionCount: '0',
      ownUnitsSold: '0',
      ownRefundedAmount: '8.00',
      ownRefundCount: '1',
      ownReturnedUnits: '1',
      ownNetRecordedSales: '-8.00',
    },
  ],
  topProducts: [
    {
      productId: '22222222-2222-4222-8222-222222222222',
      productName: 'Own refund-only item',
      sku: null,
      barcode: null,
      merchantName: 'Saved own profile',
      ownGrossSales: '0.00',
      ownUnitsSold: '0',
      ownRefundedAmount: '8.00',
      ownReturnedUnits: '1',
      ownNetRecordedSales: '-8.00',
    },
  ],
  totalProducts: '1',
});
describe('merchant analytics dashboard', () => {
  it('renders only explicitly own-labeled analytics and no staff methods/private data', () => {
    const { rerender } = render(<MerchantAnalyticsDashboard report={report} />);
    expect(screen.getByText('Own gross recorded sales')).toBeInTheDocument();
    expect(screen.getAllByText('PHP -8.00').length).toBeGreaterThan(0);
    expect(screen.queryByText('Gross sale payments')).not.toBeInTheDocument();
    expect(screen.queryByText('Actual refund methods')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/contact|cashier|reference/i),
    ).not.toBeInTheDocument();
    rerender(
      <MerchantAnalyticsDashboard report={report} activeTab="rankings" />,
    );
    expect(screen.getByText('Own refund-only item')).toBeInTheDocument();
  });
  it('provides exact own daily and product tables with decorative charts hidden', () => {
    const { container, rerender } = render(
      <MerchantAnalyticsDashboard report={report} />,
    );
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(
      2,
    );
    rerender(<MerchantAnalyticsDashboard report={report} activeTab="daily" />);
    expect(
      within(
        screen.getByRole('table', {
          name: 'Daily own-sales data in Asia/Manila',
        }),
      ).getByText('PHP -8.00'),
    ).toBeInTheDocument();
    rerender(
      <MerchantAnalyticsDashboard report={report} activeTab="rankings" />,
    );
    expect(
      screen.getByRole('table', { name: 'Own top products by gross sales' }),
    ).toBeInTheDocument();
  });
});
