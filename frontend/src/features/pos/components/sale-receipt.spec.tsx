import { walletSnapshot } from '@/features/pos/model/payment-account.test-fixtures';
import { fireEvent, render, screen } from '@testing-library/react';
import { completedSale } from '../model/pos.test-fixtures';
import { SaleReceipt } from './sale-receipt';
describe('persisted internal receipt', () => {
  afterEach(() => vi.restoreAllMocks());
  it('renders snapshots and prints without checkout or refresh requests', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const view = render(<SaleReceipt sale={completedSale} />);
    expect(screen.getAllByText('Saved Store')).toHaveLength(2);
    expect(screen.getAllByText('Saved Cashier')).toHaveLength(2);
    expect(screen.getAllByText('Change')).toHaveLength(2);
    expect(screen.getAllByText('PHP 150.00')).toHaveLength(2);
    expect(screen.getAllByText(/Not a fiscal\/tax invoice/)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(
      /checkout will not repeat/,
    );
    expect(document.getElementById('pos-receipt-print-root')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    view.unmount();
    expect(document.getElementById('pos-receipt-print-root')).toBeNull();
  });
  it('offers print-only retry after failure and labels manual payment unverified', () => {
    const print = vi
      .spyOn(window, 'print')
      .mockImplementationOnce(() => {
        throw new Error('printer');
      })
      .mockImplementation(() => {});
    render(
      <SaleReceipt
        sale={{
          ...completedSale,
          ...walletSnapshot,
          cashTender: null,
          cashChange: null,
          paymentReference: 'SAVED-REF',
        }}
      />,
    );
    expect(screen.getAllByText('Reference')).toHaveLength(2);
    expect(screen.getAllByText('SAVED-REF')).toHaveLength(2);
    expect(screen.getAllByText(/unverified by provider/)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(screen.getByRole('status')).toHaveTextContent(/already completed/);
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledTimes(2);
  });
});
