import { render, screen, within } from '@testing-library/react';
import { StaffReportSummary } from './staff-report-summary';
import { MerchantReportSummary } from './merchant-report-summary';
import {
  staffSalesReportSchema,
  merchantSalesReportSchema,
} from '../model/report.schemas';
const base = {
  branch: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Main',
    code: null,
  },
  from: '2026-09-13T16:00:00.000Z',
  until: '2026-09-14T16:00:00.000Z',
};
describe('refund-aware report presentation', () => {
  it('keeps gross payments separate from actual refund methods and permits refund-only negative periods', () => {
    const report = staffSalesReportSchema.parse({
      ...base,
      scope: 'STAFF',
      grossSales: '0.00',
      transactionCount: '0',
      unitsSold: '0',
      refundedAmount: '850.00',
      refundCount: '1',
      returnedUnits: '1',
      netRecordedSales: '-850.00',
      payments: ['CASH', 'GCASH', 'CARD'].map((paymentMethod) => ({
        paymentMethod,
        grossSales: '0.00',
        transactionCount: '0',
      })),
      refundMethods: ['CASH', 'GCASH', 'CARD'].map((paymentMethod) => ({
        paymentMethod,
        refundedAmount: paymentMethod === 'GCASH' ? '850.00' : '0.00',
        refundCount: paymentMethod === 'GCASH' ? '1' : '0',
      })),
    });
    render(<StaffReportSummary report={report} />);
    expect(screen.getByLabelText('Refund and net summary')).toHaveTextContent(
      'PHP -850.00',
    );
    expect(
      within(
        screen.getByRole('list', { name: 'Payment breakdown' }),
      ).queryByText(/850.00/),
    ).not.toBeInTheDocument();
    expect(
      within(
        screen.getByRole('list', { name: 'Refund method breakdown' }),
      ).getByText('Refunded: PHP 850.00'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No completed sales/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Refunds use refund processing dates/),
    ).toHaveTextContent('negative; it is not profit or available cash');
  });
  it('renders merchant own refunds/net only, with no payment methods or whole amounts', () => {
    const report = merchantSalesReportSchema.parse({
      ...base,
      scope: 'MERCHANT',
      ownGrossSales: '0.00',
      ownTransactionCount: '0',
      ownUnitsSold: '0',
      ownRefundedAmount: '15.01',
      ownRefundCount: '1',
      ownReturnedUnits: '2',
      ownNetRecordedSales: '-15.01',
    });
    render(<MerchantReportSummary report={report} />);
    expect(screen.getByText('Own refunded amount')).toBeInTheDocument();
    expect(screen.getByText('Own net recorded sales')).toBeInTheDocument();
    expect(screen.getByText('-15.01')).toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: /breakdown/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Cash|GCash|Card|No sales involving/i),
    ).not.toBeInTheDocument();
  });
  it('rejects an entirely absent own refund group', () => {
    expect(
      merchantSalesReportSchema.safeParse({
        ...base,
        scope: 'MERCHANT',
        ownGrossSales: '0.00',
        ownTransactionCount: '0',
        ownUnitsSold: '0',
      }).success,
    ).toBe(false);
  });
});
