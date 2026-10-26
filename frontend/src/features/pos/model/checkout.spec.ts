import {
  cashAccount,
  walletAccount,
  bankAccount,
  walletSnapshot,
} from '@/features/pos/model/payment-account.test-fixtures';
import {
  checkoutContent,
  paymentError,
  changeEstimate,
  completedSaleSchema,
} from './checkout';
import { completedSale, product } from './pos.test-fixtures';
const cash = {
  account: cashAccount,
  tender: ' 1000.0 ',
  reference: '',
};
const lines = [{ product, quantity: 1, quantityInput: '1' }];
describe('checkout client validation and exact amounts', () => {
  it.each(['', '-1', '1e3', '1000.001', '1,000', '1'.repeat(23)])(
    'rejects malformed tender %s',
    (tender) => {
      expect(paymentError({ ...cash, tender }, '850.00')).toBeDefined();
    },
  );
  it('requires sufficient cash and a valid cart', () => {
    expect(paymentError({ ...cash, tender: '849.99' }, '850.00')).toMatch(
      /below total/,
    );
    expect(() => checkoutContent([], cash)).toThrow(/quantities/);
    expect(() =>
      checkoutContent([{ ...lines[0], quantityInput: '11' }], cash),
    ).toThrow(/quantities/);
    expect(checkoutContent(lines, cash)).toEqual({
      items: [
        {
          branchInventoryId: product.branchInventoryId,
          quantity: 1,
          expectedUnitPrice: '850.00',
        },
      ],
      paymentAccountId: cashAccount.id,
      cashTender: '1000.00',
    });
  });
  it('calculates exact cents, including values beyond safe integers', () => {
    expect(changeEstimate(cash, '850.00')).toBe('150.00');
    expect(
      changeEstimate(
        { ...cash, tender: '9999999999999999999999.99' },
        '9999999999999999999999.98',
      ),
    ).toBe('0.01');
    expect(changeEstimate({ ...cash, tender: '0.02' }, '0.03')).toBeNull();
  });
  it.each([walletAccount, bankAccount])(
    'emits only the trimmed manual reference for $name',
    (account) => {
      expect(
        checkoutContent(lines, {
          ...cash,
          account,
          reference: ' ref-001 ',
        }),
      ).toMatchObject({
        paymentAccountId: account.id,
        paymentReference: 'ref-001',
      });
      expect(
        checkoutContent(lines, {
          ...cash,
          account,
          reference: ' ref-001 ',
        }),
      ).not.toHaveProperty('cashTender');
      expect(
        paymentError({ ...cash, account, reference: ' a ' }, '850.00'),
      ).toBeDefined();
      expect(
        paymentError(
          { ...cash, account, reference: 'a'.repeat(101) },
          '850.00',
        ),
      ).toBeDefined();
    },
  );
  it('accepts persisted snapshots and strips private retry/actor fields', () => {
    expect(
      completedSaleSchema.parse({
        ...completedSale,
        requestId: 'secret',
        createdById: 'secret',
      }),
    ).toEqual(completedSale);
  });
  it.each([
    { total: '850.01' },
    { cashChange: '151.00' },
    { cashTender: '849.00' },
    { paymentReference: 'forbidden' },
    { total: 850 },
    { total: '1e3' },
    { cashTender: '-1000.00' },
    { ...walletSnapshot },
    { completedAt: 'invalid' },
  ])('rejects malformed/inconsistent receipts %j', (changes) => {
    expect(
      completedSaleSchema.safeParse({ ...completedSale, ...changes }).success,
    ).toBe(false);
  });
});
