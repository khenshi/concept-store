import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { PaymentConfirmation } from './payment-confirmation';
import { setCheckoutAttempt } from '../model/checkout-attempt';
import {
  cashAccount,
  walletAccount,
  walletSnapshot,
} from '../model/payment-account.test-fixtures';
import { completedSale, product, scope } from '../model/pos.test-fixtures';

const key = 'dynamic-account-availability';
const callbacks = {
  onClose: vi.fn(),
  onCompleted: vi.fn(),
  onIssue: vi.fn(),
  onUnsafeChange: vi.fn(),
};
const props = {
  ...callbacks,
  scope,
  open: true,
  attemptKey: key,
  lines: [{ product, quantity: 1, quantityInput: '1' }],
};
function chooseWallet() {
  fireEvent.click(screen.getByRole('combobox', { name: 'Payment account' }));
  fireEvent.click(screen.getByRole('option', { name: 'GCash Main' }));
}
beforeEach(() => {
  vi.clearAllMocks();
  setCheckoutAttempt(key, null);
});
afterEach(() => setCheckoutAttempt(key, null));
it('shows a readable fallback when recovering an unavailable account without exposing its ID', async () => {
  setCheckoutAttempt(key, {
    scope,
    lines: props.lines,
    state: 'unknown',
    command: {
      requestId: crypto.randomUUID(),
      paymentAccountId: walletAccount.id,
      items: [
        {
          branchInventoryId: product.branchInventoryId,
          quantity: 1,
          expectedUnitPrice: '850.00',
        },
      ],
    },
  });
  const request = vi.fn(async () => [cashAccount]);
  render(<PaymentConfirmation {...props} request={request as never} />);
  expect(
    screen.getByText('Locked account: Previously selected account'),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(walletAccount.id, { exact: false }),
  ).not.toBeInTheDocument();
  await waitFor(() => expect(request).toHaveBeenCalledOnce());
  expect(
    screen.getByRole('button', { name: 'Retry same checkout' }),
  ).toBeEnabled();
});
it('clears a stale draft account on availability refresh and requires an explicit replacement', async () => {
  let accounts = [cashAccount, { ...walletAccount, requiresReference: false }];
  const request = vi.fn(async (path: string) => {
    if (!path.includes('/payment-accounts?'))
      throw new Error('Unexpected request');
    return accounts;
  });
  render(<PaymentConfirmation {...props} request={request as never} />);
  await screen.findByRole('textbox', { name: 'Cash tender (PHP)' });
  chooseWallet();
  expect(screen.getByRole('button', { name: 'Complete sale' })).toBeEnabled();
  accounts = [cashAccount];
  act(() => {
    window.dispatchEvent(new Event('focus'));
  });
  await waitFor(() =>
    expect(
      screen.getByRole('combobox', { name: 'Payment account' }),
    ).toHaveTextContent('Choose payment account'),
  );
  expect(screen.getByRole('button', { name: 'Complete sale' })).toBeDisabled();
  expect(
    request.mock.calls.every(
      ([path]) => typeof path === 'string' && path.includes('operation=SALE'),
    ),
  ).toBe(true);
  expect(callbacks.onCompleted).not.toHaveBeenCalled();
});
it('keeps an unknown command frozen when its account is renamed and disabled, then retrieves its saved snapshot', async () => {
  let accounts = [cashAccount, { ...walletAccount, requiresReference: false }];
  const posts: string[] = [];
  const saved = {
    ...completedSale,
    ...walletSnapshot,
    paymentAccountName: 'Saved wallet name',
    paymentAccountRequiresReference: false,
    cashTender: null,
    cashChange: null,
  };
  const request = vi.fn(async (path: string, init?: RequestInit) => {
    if (path.includes('/payment-accounts?')) return accounts;
    posts.push(String(init?.body));
    if (posts.length === 1) throw new TypeError('Response lost');
    return saved;
  });
  render(<PaymentConfirmation {...props} request={request as never} />);
  await screen.findByRole('textbox', { name: 'Cash tender (PHP)' });
  chooseWallet();
  fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
  const retry = await screen.findByRole('button', {
    name: 'Retry same checkout',
  });
  expect(
    screen.getByRole('combobox', { name: 'Payment account' }),
  ).toBeDisabled();
  accounts = [
    cashAccount,
    {
      ...walletAccount,
      name: 'Renamed',
      enabled: false,
      available: false,
      requiresReference: false,
    },
  ];
  act(() => {
    window.dispatchEvent(new Event('focus'));
  });
  await waitFor(() =>
    expect(
      request.mock.calls.filter(([path]) =>
        path.includes('/payment-accounts?'),
      ),
    ).toHaveLength(2),
  );
  fireEvent.click(retry);
  await waitFor(() =>
    expect(callbacks.onCompleted).toHaveBeenCalledWith(saved),
  );
  expect(posts).toHaveLength(2);
  expect(posts[1]).toBe(posts[0]);
  expect(JSON.parse(posts[0])).toMatchObject({
    paymentAccountId: walletAccount.id,
  });
  expect(JSON.parse(posts[0])).not.toHaveProperty('paymentReference');
});
