import { checkoutContent, completedSaleSchema, paymentError } from './checkout';
import { completeCheckout } from '../api/checkout-api';
import { completedSale, product, scope } from './pos.test-fixtures';
import {
  cashAccount,
  walletAccount,
  walletSnapshot,
} from './payment-account.test-fixtures';
import { refundErrors } from '@/features/refunds/model/refund-draft';
import { staffRefundSchema } from '@/features/refunds/model/refund.schemas';
import { completeRefund } from '@/features/refunds/api/refund-api';
import {
  command as refundCommand,
  refundScope,
  remaining,
  staffRefund,
} from '@/features/refunds/model/refund.test-fixtures';

const lines = [{ product, quantity: 1, quantityInput: '1' }];
describe('dynamic payment account commands and immutable snapshots', () => {
  it('uses system identity and reference policy instead of account names', () => {
    const account = {
      ...walletAccount,
      name: 'Cash reserve',
      requiresReference: false,
    };
    const draft = { account, tender: '1000', reference: ' ' };
    const command = checkoutContent(lines, draft);
    expect(command).toEqual({
      items: [
        {
          branchInventoryId: product.branchInventoryId,
          quantity: 1,
          expectedUnitPrice: '850.00',
        },
      ],
      paymentAccountId: walletAccount.id,
    });
    expect(paymentError({ ...draft, reference: 'x' }, '850.00')).toBeDefined();
    expect(
      paymentError({ ...draft, reference: 'valid' }, '850.00'),
    ).toBeUndefined();
    expect(
      paymentError({ ...draft, account: walletAccount }, '850.00'),
    ).toBeDefined();
    expect(paymentError({ ...draft, account: null }, '850.00')).toBeDefined();
    expect(
      checkoutContent(lines, { ...draft, account: cashAccount }),
    ).toHaveProperty('cashTender', '1000.00');
    const refund = {
      lines: { [remaining[0].saleItemId]: { quantity: '1', restock: '0' } },
      reason: 'Return',
      account,
      reference: '',
    };
    expect(refundErrors(refund, remaining)).toEqual({});
    expect(
      refundErrors({ ...refund, account: walletAccount }, remaining),
    ).toHaveProperty('reference');
  });
  it('validates saved policy and exact cash fields independently from current configuration', () => {
    const saved = {
      ...completedSale,
      ...walletSnapshot,
      paymentAccountName: 'Original wallet',
      paymentAccountRequiresReference: false,
      paymentReference: null,
      cashTender: null,
      cashChange: null,
    };
    expect(completedSaleSchema.parse(saved)).toEqual(saved);
    expect(
      completedSaleSchema.safeParse({
        ...saved,
        paymentAccountRequiresReference: true,
      }).success,
    ).toBe(false);
    expect(
      completedSaleSchema.safeParse({ ...saved, cashTender: '850.00' }).success,
    ).toBe(false);
    expect(
      completedSaleSchema.safeParse({
        ...completedSale,
        paymentAccountRequiresReference: true,
      }).success,
    ).toBe(false);
    const refund = {
      ...staffRefund,
      ...walletSnapshot,
      paymentAccountRequiresReference: false,
    };
    expect(staffRefundSchema.parse(refund)).toEqual(refund);
    expect(
      staffRefundSchema.safeParse({ ...refund, paymentReference: ' ' }).success,
    ).toBe(false);
  });
  it('replays an optional-reference checkout without consulting current account availability', async () => {
    const saved = {
      ...completedSale,
      ...walletSnapshot,
      paymentAccountName: 'Original wallet',
      paymentAccountRequiresReference: false,
      paymentReference: null,
      cashTender: null,
      cashChange: null,
    };
    const command = {
      ...checkoutContent(lines, {
        account: { ...walletAccount, requiresReference: false },
        reference: '',
        tender: '',
      }),
      requestId: crypto.randomUUID(),
    };
    const request = vi.fn().mockResolvedValue(saved);
    expect(await completeCheckout(request, scope, command)).toEqual(saved);
    expect(request).toHaveBeenCalledOnce();
    request.mockResolvedValue({ ...saved, paymentAccountId: cashAccount.id });
    await expect(completeCheckout(request, scope, command)).rejects.toThrow(
      /match/,
    );
    request.mockResolvedValue({ ...saved, paymentReference: 'substituted' });
    await expect(completeCheckout(request, scope, command)).rejects.toThrow(
      /match/,
    );
  });
  it('validates the actual refund account independently from the original sale account', async () => {
    const command = { ...refundCommand, paymentAccountId: walletAccount.id };
    const saved = {
      ...staffRefund,
      ...walletSnapshot,
      paymentAccountRequiresReference: false,
    };
    const request = vi.fn().mockResolvedValue(saved);
    expect(
      await completeRefund(request, refundScope, completedSale, command),
    ).toEqual(saved);
    request.mockResolvedValue(staffRefund);
    await expect(
      completeRefund(request, refundScope, completedSale, command),
    ).rejects.toThrow(/match/);
  });
});
