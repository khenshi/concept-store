import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  PaymentAccountBreakdown,
  accountColor,
} from './payment-account-breakdown';
import { staffSalesReportSchema } from '../model/report.schemas';
import { reportAccount } from '../model/report.test-fixtures';

const cash = reportAccount('CASH', { refunded: '200.00', refundCount: '1' });
const wallet = reportAccount('GCASH', {
  received: '1000.00',
  transactionCount: '1',
});
const report = {
  scope: 'STAFF' as const,
  branch: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Main',
    code: null,
  },
  from: '2026-10-01T00:00:00Z',
  until: '2026-10-02T00:00:00Z',
  grossSales: '1000.00',
  refundedAmount: '200.00',
  netRecordedSales: '800.00',
  transactionCount: '1',
  refundCount: '1',
  returnedUnits: '1',
  unitsSold: '1',
  paymentAccounts: [cash, wallet],
};
describe('payment account reports', () => {
  it('toggles locally and switches negative account net to signed bars despite a positive overall net', () => {
    const parsed = staffSalesReportSchema.parse(report);
    render(<PaymentAccountBreakdown report={parsed} />);
    expect(
      screen.getByRole('img', { name: /Received by payment account donut/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refunded' }));
    expect(
      screen.getByRole('img', { name: /Refunded by payment account donut/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Net Received' }));
    expect(
      screen.getByRole('img', {
        name: /Net Received signed bar chart; zero baseline/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: /donut/ }),
    ).not.toBeInTheDocument();
    const table = screen.getByRole('table', {
      name: 'Exact payment account flows',
    });
    expect(table).toHaveClass(
      '[&_td]:px-4',
      '[&_td]:py-3',
      '[&_td]:align-middle',
    );
    expect(table).not.toHaveTextContent('PHP');
    expect(
      screen.getByRole('region', { name: 'Payment accounts' }),
    ).toHaveAccessibleDescription('All amounts are in PHP.');
    expect(
      screen.getByRole('img', { name: /Net Received signed bar chart/ }),
    ).not.toHaveTextContent('PHP');
    expect(
      within(table).getByRole('row', { name: /^Cash / }),
    ).toHaveTextContent('-200.00');
    expect(
      within(table).getByRole('row', { name: /GCash Main/ }),
    ).toHaveTextContent('+1000.00');
    expect(within(table).getByRole('row', { name: /Total/ })).toHaveTextContent(
      '+800.00',
    );
  });
  it('paginates only the table at 15, keeping all chart accounts and complete totals', () => {
    const rows = Array.from({ length: 16 }, (_, index) => ({
      ...reportAccount('CARD'),
      accountId: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, '0')}`,
      displayName: `Account ${index + 1}`,
      received: '1.00',
      netReceived: '1.00',
      transactionCount: '1',
    }));
    const { rerender } = render(
      <PaymentAccountBreakdown
        report={{
          ...report,
          paymentAccounts: rows,
          grossSales: '16.00',
          refundedAmount: '0.00',
          netRecordedSales: '16.00',
        }}
      />,
    );
    const table = screen.getByRole('table', {
      name: 'Exact payment account flows',
    });
    expect(within(table).getAllByRole('row')).toHaveLength(17);
    expect(within(table).queryByText('Account 16')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Received chart values')).toHaveTextContent(
      'Account 16',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(within(table).getByText('Account 16')).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /Total/ })).toHaveTextContent(
      '16.00',
    );
    rerender(
      <PaymentAccountBreakdown
        report={{ ...report, paymentAccounts: [wallet] }}
      />,
    );
    expect(within(table).getByText('GCash Main')).toBeInTheDocument();
  });
  it('keeps zero and historical accounts, exact large values, stable colors, and an honest zero-net state', () => {
    const huge = '999999999999999999999999999999.99';
    const row = {
      ...wallet,
      enabled: false,
      available: false,
      received: huge,
      refunded: huge,
      netReceived: '0.00',
      refundCount: '1',
    };
    render(
      <PaymentAccountBreakdown
        report={{
          paymentAccounts: [row],
          grossSales: huge,
          refundedAmount: huge,
          netRecordedSales: '0.00',
        }}
      />,
    );
    expect(screen.getByText('Disabled · Historical')).toBeInTheDocument();
    expect(screen.getAllByText(huge).length).toBeGreaterThan(0);
    expect(
      screen.getByLabelText('Received chart values'),
    ).not.toHaveTextContent('PHP');
    fireEvent.click(screen.getByRole('button', { name: 'Net Received' }));
    expect(
      screen.getByText('No net received in this period.'),
    ).toBeInTheDocument();
    expect(accountColor(row.accountId)).toBe(
      accountColor({ ...row, displayName: 'Renamed' }.accountId),
    );
  });
  it('rejects mismatched account arithmetic, duplicate IDs, missing activity and obsolete enum fields', () => {
    for (const paymentAccounts of [
      [cash, { ...wallet, netReceived: '999.99' }],
      [cash, wallet, wallet],
      [wallet],
      [cash, { ...wallet, paymentMethod: 'GCASH' }],
    ])
      expect(
        staffSalesReportSchema.safeParse({ ...report, paymentAccounts })
          .success,
      ).toBe(false);
    expect(
      staffSalesReportSchema.parse({
        ...report,
        paymentAccounts: [cash, wallet, reportAccount('CARD')],
      }).paymentAccounts,
    ).toHaveLength(3);
    expect(
      staffSalesReportSchema.safeParse({
        ...report,
        paymentAccounts: [{ ...cash, received: 'NaN' }, wallet],
      }).success,
    ).toBe(false);
  });
});
