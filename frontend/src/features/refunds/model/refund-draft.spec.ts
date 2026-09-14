import { completedSale } from '@/features/pos/model/pos.test-fixtures';
import { refundErrors, refundEstimate, type RefundDraft } from './refund-draft';
import { remaining } from './refund.test-fixtures';
const id = remaining[0].saleItemId;
const valid: RefundDraft = {
  lines: { [id]: { quantity: '1', restock: '0' } },
  reason: 'Damaged item',
  method: 'CASH',
  reference: '',
  confirmed: true,
};
describe('live refund draft validation', () => {
  it('accepts explicit confirmed return with default zero restock and saved-price estimate', () => {
    expect(refundErrors(valid, remaining)).toEqual({});
    expect(refundEstimate(completedSale, valid)).toBe('850.00');
  });
  it.each(['', '-1', '1.5', '2', '2147483648', 'NaN'])(
    'rejects return quantity %s against all-page remaining',
    (quantity) => {
      expect(
        refundErrors(
          { ...valid, lines: { [id]: { quantity, restock: '0' } } },
          remaining,
        )[`${id}:quantity`],
      ).toBeTruthy();
    },
  );
  it.each(['-1', '1.5', '2', '2147483648'])(
    'rejects restock quantity %s',
    (restock) => {
      expect(
        refundErrors(
          { ...valid, lines: { [id]: { quantity: '1', restock } } },
          remaining,
        )[`${id}:restock`],
      ).toBeTruthy();
    },
  );
  it('requires a selected line, reason, actual noncash reference and fresh confirmation', () => {
    expect(
      refundErrors(
        { ...valid, lines: {}, reason: ' ', method: 'GCASH', confirmed: false },
        remaining,
      ),
    ).toMatchObject({
      items: expect.any(String),
      reason: expect.any(String),
      reference: expect.any(String),
      confirmed: expect.any(String),
    });
    expect(
      refundErrors(
        { ...valid, method: 'CARD', reference: 'manual-card-ref' },
        remaining,
      ),
    ).toEqual({});
  });
  it('estimates exact large original prices without number rounding', () => {
    const sale = {
      ...completedSale,
      items: [{ ...completedSale.items[0], unitPrice: '9999999999.99' }],
    };
    expect(
      refundEstimate(sale, {
        ...valid,
        lines: { [id]: { quantity: '2147483647', restock: '0' } },
      }),
    ).toBe('21474836469978525163.53');
  });
});
