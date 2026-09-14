import {
  merchantRefundSchema,
  staffRefundSchema,
  refundCommandSchema,
  remainingItemSchema,
  staffRefundPageSchema,
  refundQuerySchema,
} from './refund.schemas';
import {
  command,
  staffRefund,
  merchantRefund,
  refundPage,
  remaining,
} from './refund.test-fixtures';
describe('strict refund contracts', () => {
  it('accepts saved staff and separately reduced merchant records', () => {
    expect(staffRefundSchema.parse(staffRefund)).toEqual(staffRefund);
    expect(merchantRefundSchema.parse(merchantRefund)).toEqual(merchantRefund);
    expect(merchantRefundSchema.safeParse(staffRefund).success).toBe(false);
  });
  it.each([
    'reason',
    'total',
    'paymentMethod',
    'paymentReference',
    'createdById',
    'requestId',
    'organizationId',
    'refundCommand',
  ])('rejects merchant private field %s rather than stripping it', (field) => {
    expect(
      merchantRefundSchema.safeParse({ ...merchantRefund, [field]: 'private' })
        .success,
    ).toBe(false);
  });
  it.each(['branchInventoryId', 'merchantId'])(
    'rejects private merchant item field %s',
    (field) => {
      expect(
        merchantRefundSchema.safeParse({
          ...merchantRefund,
          items: [{ ...merchantRefund.items[0], [field]: staffRefund.id }],
        }).success,
      ).toBe(false);
    },
  );
  it.each(['0850.00', '850', '850.0', '-850.00', '0.00', '850.01'])(
    'rejects invalid or unreconciled total %s',
    (total) => {
      expect(
        staffRefundSchema.safeParse({ ...staffRefund, total }).success,
      ).toBe(false);
    },
  );
  it.each([0, -1, 0.5, 2147483648, NaN, Infinity])(
    'safely rejects invalid returned quantity %s',
    (quantity) => {
      expect(
        staffRefundSchema.safeParse({
          ...staffRefund,
          items: [{ ...staffRefund.items[0], quantity }],
        }).success,
      ).toBe(false);
    },
  );
  it('rejects duplicate lines, excessive restock and substituted prices', () => {
    for (const items of [
      [staffRefund.items[0], staffRefund.items[0]],
      [{ ...staffRefund.items[0], restockQuantity: 2 }],
      [{ ...staffRefund.items[0], unitPrice: '851.00' }],
    ])
      expect(
        staffRefundSchema.safeParse({ ...staffRefund, items }).success,
      ).toBe(false);
  });
  it('keeps maximum-capacity arithmetic exact without floating point', () => {
    const result = {
      ...staffRefund,
      total: '21474836469978525163.53',
      items: [
        {
          ...staffRefund.items[0],
          quantity: 2147483647,
          unitPrice: '9999999999.99',
          lineTotal: '21474836469978525163.53',
        },
      ],
    };
    expect(staffRefundSchema.safeParse(result).success).toBe(true);
  });
  it('requires actual noncash references and forbids cash references', () => {
    expect(
      staffRefundSchema.safeParse({
        ...staffRefund,
        paymentReference: 'cash-ref',
      }).success,
    ).toBe(false);
    expect(
      staffRefundSchema.safeParse({ ...staffRefund, paymentMethod: 'GCASH' })
        .success,
    ).toBe(false);
    expect(
      staffRefundSchema.safeParse({
        ...staffRefund,
        paymentMethod: 'CARD',
        paymentReference: 'manual-ref',
      }).success,
    ).toBe(true);
  });
  it('requires explicit confirmation, strict commands and valid quantities', () => {
    expect(refundCommandSchema.parse(command)).toEqual(command);
    for (const changed of [
      { refundConfirmed: false },
      { total: '850.00' },
      { paymentReference: null },
      { requestId: '11111111-1111-1111-8111-111111111111' },
      { items: [...command.items, ...command.items] },
      { items: [{ ...command.items[0], restockQuantity: 2 }] },
    ])
      expect(
        refundCommandSchema.safeParse({ ...command, ...changed }).success,
      ).toBe(false);
  });
  it('reconciles remaining quantities and bounded stable pagination', () => {
    expect(staffRefundPageSchema.parse(refundPage)).toEqual(refundPage);
    expect(
      remainingItemSchema.safeParse({ ...remaining[0], returnedQuantity: 1 })
        .success,
    ).toBe(false);
    expect(
      remainingItemSchema.safeParse({ ...remaining[0], restockedQuantity: 1 })
        .success,
    ).toBe(false);
    for (const changed of [
      { totalPages: 2 },
      { total: 2 },
      { remainingItems: [...remaining, ...remaining] },
      { limit: 101 },
      { page: 0 },
      { until: '2026-09-14' },
    ])
      expect(
        staffRefundPageSchema.safeParse({ ...refundPage, ...changed }).success,
      ).toBe(false);
    expect(
      refundQuerySchema.safeParse({ page: 1, limit: 10, from: 'date' }).success,
    ).toBe(false);
  });
});
