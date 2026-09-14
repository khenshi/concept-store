import { completedSale } from '@/features/pos/model/pos.test-fixtures';
import { ownSale } from '@/features/sales/model/sales.test-fixtures';
import { completeRefund, getRefund, listRefunds } from './refund-api';
import {
  command,
  emptyPage,
  staffRefund,
  merchantRefund,
  refundPage,
  refundScope,
  ownRefundPage,
} from '../model/refund.test-fixtures';
describe('scoped refund API', () => {
  const request = vi.fn();
  beforeEach(() => vi.resetAllMocks());
  it('loads bounded staff history and all-page quantities without writes', async () => {
    request.mockResolvedValue(refundPage);
    expect(
      await listRefunds(request, refundScope, 'MANAGER', completedSale),
    ).toEqual(refundPage);
    expect(request).toHaveBeenCalledExactlyOnceWith(
      `/organizations/${refundScope.organizationId}/branches/${refundScope.branchId}/sales/${refundScope.saleId}/refunds?page=1&limit=10`,
    );
  });
  it('decodes only merchant reduced records with no staff fallback', async () => {
    request.mockResolvedValue(ownRefundPage);
    expect(
      await listRefunds(request, refundScope, 'MERCHANT', ownSale),
    ).toEqual(ownRefundPage);
    request.mockResolvedValue(refundPage);
    await expect(
      listRefunds(request, refundScope, 'MERCHANT', ownSale),
    ).rejects.toThrow();
    request.mockResolvedValue(merchantRefund);
    expect(
      await getRefund(
        request,
        refundScope,
        'MERCHANT',
        ownSale,
        merchantRefund.id,
      ),
    ).toEqual(merchantRefund);
  });
  it('does not call refund reads for cashiers or invalid queries', async () => {
    await expect(
      listRefunds(request, refundScope, 'CASHIER', completedSale),
    ).rejects.toThrow();
    await expect(
      getRefund(request, refundScope, 'CASHIER', completedSale, staffRefund.id),
    ).rejects.toThrow();
    await expect(
      listRefunds(request, refundScope, 'OWNER', completedSale, {
        page: 0,
        limit: 10,
      }),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it.each(['branchId', 'saleId', 'organizationId', 'receiptCode'])(
    'rejects wrong response %s',
    async (field) => {
      request.mockResolvedValue({ ...staffRefund, [field]: command.requestId });
      await expect(
        getRefund(request, refundScope, 'OWNER', completedSale, staffRefund.id),
      ).rejects.toThrow();
    },
  );
  it.each([
    'saleItemId',
    'productId',
    'branchInventoryId',
    'merchantId',
    'productName',
    'sku',
    'barcode',
    'merchantName',
  ])('rejects original identity substitution %s', async (field) => {
    request.mockResolvedValue({
      ...staffRefund,
      items: [{ ...staffRefund.items[0], [field]: command.requestId }],
    });
    await expect(
      getRefund(request, refundScope, 'OWNER', completedSale, staffRefund.id),
    ).rejects.toThrow();
  });
  it('rejects unrequested IDs, page substitution and sold-quantity mismatches', async () => {
    request.mockResolvedValue(staffRefund);
    await expect(
      getRefund(
        request,
        refundScope,
        'OWNER',
        completedSale,
        command.requestId,
      ),
    ).rejects.toThrow();
    request.mockResolvedValue({ ...emptyPage, page: 2 });
    await expect(
      listRefunds(request, refundScope, 'OWNER', completedSale),
    ).rejects.toThrow();
    request.mockResolvedValue({
      ...emptyPage,
      remainingItems: [
        {
          ...emptyPage.remainingItems[0],
          soldQuantity: 2,
          remainingQuantity: 2,
        },
      ],
    });
    await expect(
      listRefunds(request, refundScope, 'OWNER', completedSale),
    ).rejects.toThrow();
  });
  it('posts only the validated frozen command and verifies saved completion', async () => {
    request.mockResolvedValue(staffRefund);
    expect(
      await completeRefund(request, refundScope, completedSale, command),
    ).toEqual(staffRefund);
    expect(request.mock.calls[0][1]).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    request.mockResolvedValue({ ...staffRefund, reason: 'Different reason' });
    await expect(
      completeRefund(request, refundScope, completedSale, command),
    ).rejects.toThrow();
    request.mockResolvedValue({
      ...staffRefund,
      items: [{ ...staffRefund.items[0], restockQuantity: 1 }],
    });
    await expect(
      completeRefund(request, refundScope, completedSale, command),
    ).rejects.toThrow();
  });
});
