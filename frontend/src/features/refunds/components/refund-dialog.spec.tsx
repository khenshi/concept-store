import { paymentAccounts } from '@/features/pos/model/payment-account.test-fixtures';
vi.mock('@/features/pos/model/use-branch-payment-accounts', () => ({
  useBranchPaymentAccounts: () => ({
    accounts: paymentAccounts,
    refresh: vi.fn(),
  }),
  paymentAccountHistoryLabel: (account: { name: string }) => account.name,
}));
import {
  cashAccount,
  walletSnapshot,
} from '@/features/pos/model/payment-account.test-fixtures';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { completedSale } from '@/features/pos/model/pos.test-fixtures';
import { ApiError } from '@/features/auth/api/auth-client';
import { getRefundAttempt, setRefundAttempt } from '../model/refund-attempt';
import {
  remaining,
  staffRefund,
  refundScope,
} from '../model/refund.test-fixtures';
import { RefundDialog } from './refund-dialog';
describe('manual refund dialog and frozen recovery', () => {
  const request = vi.fn();
  const onClose = vi.fn();
  const onCompleted = vi.fn();
  const onIssue = vi.fn();
  const key = 'refund-dialog-actor';
  function mount() {
    return render(
      <RefundDialog
        request={request}
        scope={refundScope}
        sale={completedSale}
        remaining={remaining}
        attemptKey={key}
        onClose={onClose}
        onCompleted={onCompleted}
        onIssue={onIssue}
      />,
    );
  }
  function fill() {
    fireEvent.change(screen.getByRole('textbox', { name: /Return units/ }), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Refund reason' }), {
      target: { value: 'Damaged item' },
    });
  }
  function submit() {
    fireEvent.click(screen.getByRole('button', { name: 'Record refund' }));
  }
  beforeEach(() => {
    vi.resetAllMocks();
    setRefundAttempt(key, null);
  });
  afterEach(() => {
    vi.useRealTimers();
    setRefundAttempt(key, null);
    vi.restoreAllMocks();
  });
  it('recovers when remounted during a pending request that later becomes unknown', async () => {
    let reject!: (cause: unknown) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const first = mount();
    fill();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Record refund' }),
      ).toBeEnabled(),
    );
    submit();
    await waitFor(() => expect(getRefundAttempt(key)?.state).toBe('pending'));
    first.unmount();
    mount();
    expect(
      screen.getByRole('textbox', { name: 'Refund reason' }),
    ).toBeDisabled();
    await act(async () => reject(new Error('network interrupted')));
    const retry = await screen.findByRole('button', {
      name: 'Retry same refund',
    });
    expect(retry).toBeEnabled();
    request.mockResolvedValueOnce(staffRefund);
    fireEvent.click(retry);
    await waitFor(() => expect(onCompleted).toHaveBeenCalledOnce());
    expect(request.mock.calls[1]).toEqual(request.mock.calls[0]);
  });
  it('closes and refreshes after an inherited pending request receives a known rejection', async () => {
    let reject!: (cause: unknown) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const first = mount();
    fill();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Record refund' }),
      ).toBeEnabled(),
    );
    submit();
    await waitFor(() => expect(getRefundAttempt(key)?.state).toBe('pending'));
    first.unmount();
    mount();
    await act(async () => reject(new ApiError(400, 'Invalid return.')));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onIssue).toHaveBeenCalledWith(
      expect.stringContaining('Refresh and review'),
      false,
    );
    expect(getRefundAttempt(key)).toBeNull();
    expect(request).toHaveBeenCalledOnce();
  });
  it('validates each input after 300ms and disables incomplete submissions', async () => {
    vi.useFakeTimers();
    mount();
    expect(
      screen.getByRole('button', { name: 'Record refund' }),
    ).toBeDisabled();
    const quantity = screen.getByRole('textbox', { name: /Return units/ });
    fireEvent.change(quantity, { target: { value: '2' } });
    expect(quantity).not.toHaveAttribute('aria-invalid', 'true');
    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(quantity).not.toHaveAttribute('aria-invalid', 'true');
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(quantity).toHaveAttribute('aria-invalid', 'true');
    expect(quantity).toHaveClass('bg-subtle');
    expect(quantity).not.toHaveClass('border');
    expect(
      screen.queryByText('Enter whole units from 0 to 1.'),
    ).not.toBeInTheDocument();
    fireEvent.change(quantity, { target: { value: '1' } });
    fireEvent.blur(quantity);
    expect(quantity).not.toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByRole('button', { name: 'Record refund' }),
    ).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Refund reason' }), {
      target: { value: 'Damaged item' },
    });
    expect(screen.getByRole('button', { name: 'Record refund' })).toBeEnabled();
    expect(request).not.toHaveBeenCalled();
  });
  it('defaults to original method and empty quantities and records saved prices', async () => {
    request.mockResolvedValue(staffRefund);
    mount();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Product' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Returnable' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Refund account' }),
    ).toHaveTextContent('Cash');
    expect(
      screen.getByRole('textbox', { name: 'Account reference' }),
    ).toBeDisabled();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Refund account' }),
    ).toHaveTextContent('Cash');
    expect(screen.getByRole('textbox', { name: /Return units/ })).toHaveValue(
      '',
    );
    expect(screen.getByRole('textbox', { name: /Restock units/ })).toHaveValue(
      '',
    );
    fireEvent.change(screen.getByRole('textbox', { name: /Return units/ }), {
      target: { value: '' },
    });
    expect(screen.getByRole('textbox', { name: /Return units/ })).toHaveValue(
      '',
    );
    fill();
    expect(screen.getByText('Estimated refund')).toBeInTheDocument();
    expect(screen.getByText('PHP 850.00')).toBeInTheDocument();
    submit();
    await waitFor(() => expect(onCompleted).toHaveBeenCalledOnce());
    const body = JSON.parse(request.mock.calls[0][1].body);
    expect(body).toMatchObject({
      refundConfirmed: true,
      paymentAccountId: cashAccount.id,
      reason: 'Damaged item',
      items: [
        {
          saleItemId: remaining[0].saleItemId,
          quantity: 1,
          restockQuantity: 0,
        },
      ],
    });
    expect(body).not.toHaveProperty('total');
    expect(body).not.toHaveProperty('paymentReference');
    expect(getRefundAttempt(key)?.state).toBe('completed');
  });
  it('switching actual method clears reference; noncash stays available', async () => {
    request.mockResolvedValue({
      ...staffRefund,
      ...walletSnapshot,
      paymentReference: 'manual-ref',
    });
    mount();
    fill();
    fireEvent.click(screen.getByRole('combobox', { name: 'Refund account' }));
    fireEvent.click(screen.getByRole('option', { name: 'GCash Main' }));
    submit();
    expect(request).not.toHaveBeenCalled();
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Account reference' }),
      { target: { value: 'manual-ref' } },
    );
    submit();
    await waitFor(() => expect(onCompleted).toHaveBeenCalledOnce());
    expect(JSON.parse(request.mock.calls[0][1].body).paymentReference).toBe(
      'manual-ref',
    );
  });
  it('does not validate untouched fields when selecting a refund method', () => {
    mount();
    fireEvent.click(screen.getByRole('combobox', { name: 'Refund account' }));
    fireEvent.click(screen.getByRole('option', { name: 'GCash Main' }));
    expect(
      screen.getByRole('textbox', { name: 'Refund reason' }),
    ).not.toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByRole('textbox', { name: 'Account reference' }),
    ).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('2–500 characters')).not.toBeInTheDocument();
  });
  it('freezes pending command, prevents duplicate submissions and dismissal', async () => {
    request.mockReturnValue(new Promise(() => {}));
    mount();
    fill();
    submit();
    expect(
      screen.getByRole('textbox', { name: 'Refund reason' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: true, cancelable: true }),
    );
    expect(request).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });
  it.each([
    new Error('Network failed'),
    new ApiError(500, 'Unavailable'),
    new ApiError(409, 'Retry', { code: 'REFUND_RETRY' }),
    new ApiError(409, 'Conflicting request', { code: 'REQUEST_ID_CONFLICT' }),
  ])(
    'locks uncertain outcome and explicitly retries exact command after %s',
    async (cause) => {
      request.mockRejectedValueOnce(cause).mockResolvedValueOnce(staffRefund);
      mount();
      fill();
      submit();
      const retry = await screen.findByRole('button', {
        name: 'Retry same refund',
      });
      expect(
        screen.getByRole('textbox', { name: /Return units/ }),
      ).toBeDisabled();
      expect(onCompleted).not.toHaveBeenCalled();
      const submitted = request.mock.calls[0][1].body;
      fireEvent.click(retry);
      await waitFor(() => expect(onCompleted).toHaveBeenCalledOnce());
      expect(request.mock.calls[1][1].body).toBe(submitted);
    },
  );
  it('does not unlock an original unknown command after later access denial', async () => {
    request
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockRejectedValueOnce(new ApiError(403, 'Access revoked'));
    mount();
    fill();
    submit();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Retry same refund' }),
    );
    await waitFor(() => expect(getRefundAttempt(key)?.state).toBe('unknown'));
    expect(
      screen.getByRole('textbox', { name: 'Refund reason' }),
    ).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
    expect(onIssue).not.toHaveBeenCalled();
    expect(request.mock.calls[1][1].body).toBe(request.mock.calls[0][1].body);
  });
  it('treats a malformed success as unknown rather than creating a new request', async () => {
    request
      .mockResolvedValueOnce({ ...staffRefund, total: '850.01' })
      .mockResolvedValueOnce(staffRefund);
    mount();
    fill();
    submit();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Retry same refund' }),
    );
    await waitFor(() => expect(onCompleted).toHaveBeenCalledOnce());
    expect(request.mock.calls[1][1].body).toBe(request.mock.calls[0][1].body);
  });
  it('retains identical ID after known validation rejection and changes ID only for changed content', async () => {
    request.mockRejectedValue(new ApiError(400, 'Review reason'));
    mount();
    fill();
    submit();
    await screen.findByText('Review reason');
    const original = request.mock.calls[0][1].body;
    submit();
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request.mock.calls[1][1].body).toBe(original);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Record refund' }),
      ).toBeEnabled(),
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Refund reason' }), {
      target: { value: 'Changed reason' },
    });
    submit();
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    expect(JSON.parse(request.mock.calls[2][1].body).requestId).not.toBe(
      JSON.parse(original).requestId,
    );
  });
  it.each(['RETURN_QUANTITY_EXCEEDED', 'STOCK_OVERFLOW'])(
    'closes %s conflict for fresh quantity review without hidden retry',
    async (code) => {
      request.mockRejectedValue(
        new ApiError(409, 'Review quantities', { code }),
      );
      mount();
      fill();
      submit();
      await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
      expect(onIssue).toHaveBeenCalledWith(
        expect.stringContaining('Refresh and review'),
        false,
      );
      expect(getRefundAttempt(key)).toBeNull();
      expect(request).toHaveBeenCalledOnce();
    },
  );
  it('preserves unresolved command across unmount and explicit recovery', async () => {
    request
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce(staffRefund);
    const view = mount();
    fill();
    submit();
    await screen.findByRole('button', { name: 'Retry same refund' });
    const submitted = request.mock.calls[0][1].body;
    view.unmount();
    mount();
    expect(screen.getByRole('textbox', { name: 'Refund reason' })).toHaveValue(
      'Damaged item',
    );
    expect(request).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Retry same refund' }));
    await waitFor(() => expect(onCompleted).toHaveBeenCalledOnce());
    expect(request.mock.calls[1][1].body).toBe(submitted);
  });
  it('records late completion for the original actor without calling unmounted UI', async () => {
    let resolve!: (value: unknown) => void;
    request.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const view = mount();
    fill();
    submit();
    view.unmount();
    await act(async () => {
      resolve(staffRefund);
    });
    expect(getRefundAttempt(key)?.state).toBe('completed');
    expect(onCompleted).not.toHaveBeenCalled();
  });
});
