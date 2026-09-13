import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ApiError } from '@/features/auth/api/auth-client';
import { completeCheckout } from '../api/checkout-api';
import { product, scope, completedSale } from '../model/pos.test-fixtures';
import { PaymentConfirmation } from './payment-confirmation';
import { setCheckoutAttempt } from '../model/checkout-attempt';
vi.mock('../api/checkout-api', () => ({ completeCheckout: vi.fn() }));
describe('payment confirmation', () => {
  const callbacks = {
    onClose: vi.fn(),
    onIssue: vi.fn(),
    onCompleted: vi.fn(),
    onUnsafeChange: vi.fn(),
  };
  const props = {
    attemptKey: 'payment-test',
    open: true,
    request: vi.fn(),
    scope,
    lines: [{ product, quantity: 1, quantityInput: '1' }],
    ...callbacks,
  };
  function pay() {
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Cash tender (PHP)' }),
      { target: { value: '1000' } },
    );
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
  }
  beforeEach(() => {
    setCheckoutAttempt('payment-test', null);
    vi.resetAllMocks();
    vi.mocked(completeCheckout).mockResolvedValue(completedSale);
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('validates on each input with debounce, blur and final submit', async () => {
    render(<PaymentConfirmation {...props} />);
    vi.useFakeTimers();
    const field = screen.getByRole('textbox', { name: 'Cash tender (PHP)' });
    fireEvent.change(field, { target: { value: '1e3' } });
    expect(screen.queryByText(/Enter a PHP amount/)).not.toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(field, { target: { value: '849.99' } });
    fireEvent.blur(field);
    expect(
      screen.getByText('Cash tender must cover the total.'),
    ).toBeInTheDocument();
    fireEvent.change(field, { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Confirm/);
    expect(completeCheckout).not.toHaveBeenCalled();
  });
  it('blocks pending repeat activation, edits and Escape dismissal', async () => {
    let resolve!: (value: typeof completedSale) => void;
    vi.mocked(completeCheckout).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<PaymentConfirmation {...props} />);
    pay();
    expect(
      screen.getByRole('textbox', { name: 'Cash tender (PHP)' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Return to cart' }),
    ).toBeDisabled();
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Completing checkout…' })
        .closest('form')!,
    );
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true }),
    );
    expect(callbacks.onClose).not.toHaveBeenCalled();
    expect(completeCheckout).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve(completedSale);
    });
    expect(callbacks.onCompleted).toHaveBeenCalledExactlyOnceWith(
      completedSale,
    );
  });
  it.each([
    new TypeError('network'),
    new ApiError(503, 'unavailable'),
    new Error('Malformed receipt'),
    new ApiError(409, 'conflict', { code: 'REQUEST_ID_CONFLICT' }),
  ])('locks unknown command for identical retry: %s', async (error) => {
    vi.mocked(completeCheckout)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(completedSale);
    render(<PaymentConfirmation {...props} />);
    pay();
    await screen.findByRole('button', { name: 'Retry same checkout' });
    expect(
      screen.getByRole('textbox', { name: 'Cash tender (PHP)' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Return to cart' }),
    ).toBeDisabled();
    const first = vi.mocked(completeCheckout).mock.calls[0][2];
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry same checkout' }),
    );
    await waitFor(() => expect(callbacks.onCompleted).toHaveBeenCalled());
    expect(vi.mocked(completeCheckout).mock.calls[1][2]).toEqual(first);
    expect(callbacks.onIssue).not.toHaveBeenCalled();
  });
  it('does not unlock a previously unknown checkout on a later rejection', async () => {
    vi.mocked(completeCheckout)
      .mockRejectedValueOnce(new TypeError('network'))
      .mockRejectedValueOnce(new ApiError(403, 'revoked'));
    render(<PaymentConfirmation {...props} />);
    pay();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Retry same checkout' }),
    );
    await waitFor(() => expect(completeCheckout).toHaveBeenCalledTimes(2));
    expect(
      screen.getByRole('button', { name: 'Return to cart' }),
    ).toBeDisabled();
    expect(callbacks.onClose).not.toHaveBeenCalled();
    expect(callbacks.onIssue).not.toHaveBeenCalled();
  });
  it('retains IDs for unchanged known failures and replaces them only after edits', async () => {
    vi.mocked(completeCheckout).mockRejectedValue(
      new ApiError(409, 'retry', { code: 'CHECKOUT_RETRY' }),
    );
    render(<PaymentConfirmation {...props} />);
    pay();
    await screen.findByText(/rolled back/);
    fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
    await waitFor(() => expect(completeCheckout).toHaveBeenCalledTimes(2));
    expect(vi.mocked(completeCheckout).mock.calls[1][2]).toEqual(
      vi.mocked(completeCheckout).mock.calls[0][2],
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Cash tender (PHP)' }),
      { target: { value: '1100' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
    await waitFor(() => expect(completeCheckout).toHaveBeenCalledTimes(3));
    expect(vi.mocked(completeCheckout).mock.calls[2][2].requestId).not.toBe(
      vi.mocked(completeCheckout).mock.calls[0][2].requestId,
    );
  });
  it('keeps the normalized request ID after returning to the unchanged cart for review', async () => {
    vi.mocked(completeCheckout)
      .mockRejectedValueOnce(
        new ApiError(409, 'retry', { code: 'CHECKOUT_RETRY' }),
      )
      .mockResolvedValueOnce(completedSale);
    const view = render(<PaymentConfirmation {...props} />);
    pay();
    await screen.findByText(/rolled back/);
    const first = vi.mocked(completeCheckout).mock.calls[0][2];
    fireEvent.click(screen.getByRole('button', { name: 'Return to cart' }));
    view.rerender(<PaymentConfirmation {...props} open={false} />);
    view.rerender(<PaymentConfirmation {...props} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Cash tender (PHP)' }),
      { target: { value: '01000.00' } },
    );
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
    await waitFor(() => expect(callbacks.onCompleted).toHaveBeenCalled());
    expect(vi.mocked(completeCheckout).mock.calls[1][2]).toEqual(first);
  });
  it.each(['PRICE_CHANGED', 'INSUFFICIENT_STOCK', 'PRODUCT_UNAVAILABLE'])(
    'returns %s to cart review and resets receipt confirmation',
    async (code) => {
      vi.mocked(completeCheckout).mockRejectedValueOnce(
        new ApiError(409, 'Review required', {
          code,
          branchInventoryId: product.branchInventoryId,
          sellingPrice: '900.00',
          quantity: 0,
        }),
      );
      const view = render(<PaymentConfirmation {...props} />);
      pay();
      await waitFor(() => expect(callbacks.onClose).toHaveBeenCalled());
      expect(callbacks.onIssue).toHaveBeenCalledWith(
        expect.objectContaining({ code }),
      );
      view.rerender(
        <PaymentConfirmation
          {...props}
          lines={[
            {
              ...props.lines[0],
              product: { ...product, sellingPrice: '900.00' },
            },
          ]}
        />,
      );
      expect(screen.getByRole('checkbox')).not.toBeChecked();
      expect(completeCheckout).toHaveBeenCalledTimes(1);
    },
  );
  it.each(['GCash (manual)', 'Card (manual)'])(
    'records %s without cash fields and requires received confirmation',
    async (label) => {
      render(<PaymentConfirmation {...props} />);
      fireEvent.click(screen.getByRole('radio', { name: label }));
      expect(
        screen.getByText(/Manually recorded and unverified/),
      ).toBeInTheDocument();
      fireEvent.change(
        screen.getByRole('textbox', { name: 'Payment reference' }),
        { target: { value: ' ref-001 ' } },
      );
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
      await waitFor(() => expect(completeCheckout).toHaveBeenCalled());
      const command = vi.mocked(completeCheckout).mock.calls[0][2];
      expect(command).toHaveProperty('paymentReference', 'ref-001');
      expect(command).not.toHaveProperty('cashTender');
    },
  );
});
