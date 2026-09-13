import {
  checkoutContent,
  paymentError,
  changeEstimate,
  completedSaleSchema,
} from './checkout';
import { completedSale, product } from './pos.test-fixtures';
const cash = {
  method: 'CASH' as const,
  tender: ' 1000.0 ',
  reference: '',
  received: true,
};
const lines = [{ product, quantity: 1, quantityInput: '1' }];
describe('checkout client validation and exact amounts', () => {
  it.each(['', '-1', '1e3', '1000.001', '1,000', '1'.repeat(23)])(
    'rejects malformed tender %s',
    (tender) => {
      expect(paymentError({ ...cash, tender }, '850.00')).toBeDefined();
    },
  );
  it('requires sufficient cash, explicit received confirmation and valid cart', () => {
    expect(paymentError({ ...cash, tender: '849.99' }, '850.00')).toMatch(
      /cover/,
    );
    expect(() => checkoutContent(lines, { ...cash, received: false })).toThrow(
      /received/,
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
      paymentMethod: 'CASH',
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
  it.each(['GCASH', 'CARD'] as const)(
    'emits only the trimmed manual reference for %s',
    (method) => {
      expect(
        checkoutContent(lines, { ...cash, method, reference: ' ref-001 ' }),
      ).toMatchObject({ paymentMethod: method, paymentReference: 'ref-001' });
      expect(
        checkoutContent(lines, { ...cash, method, reference: ' ref-001 ' }),
      ).not.toHaveProperty('cashTender');
      expect(
        paymentError({ ...cash, method, reference: ' a ' }, '850.00'),
      ).toBeDefined();
      expect(
        paymentError({ ...cash, method, reference: 'a'.repeat(101) }, '850.00'),
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
    { paymentMethod: 'GCASH' },
    { completedAt: 'invalid' },
  ])('rejects malformed/inconsistent receipts %j', (changes) => {
    expect(
      completedSaleSchema.safeParse({ ...completedSale, ...changes }).success,
    ).toBe(false);
  });
});
