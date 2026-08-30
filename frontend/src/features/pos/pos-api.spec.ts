import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import {
  checkoutSale,
  getSale,
  listPosProducts,
  listSales,
  lookupPosProduct,
} from './pos-api';

describe('POS API', () => {
  const request = vi.fn() as unknown as AuthenticatedRequest;

  beforeEach(() => vi.clearAllMocks());

  it('lists branch products with bounded filters', async () => {
    vi.mocked(request).mockResolvedValue({});
    await listPosProducts(request, 'organization id', 'branch id', {
      search: 'woven pouch',
      merchantId: 'merchant-id',
      offset: 30,
      limit: 30,
    });
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%20id/branches/branch%20id/pos/products?search=woven+pouch&merchantId=merchant-id&offset=30&limit=30',
    );
  });

  it('looks up a product using an exact SKU or barcode', async () => {
    vi.mocked(request).mockResolvedValue({});
    await lookupPosProduct(request, 'organization-id', 'branch-id', 'AMH-01');
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/branches/branch-id/pos/products/lookup?code=AMH-01',
    );
  });

  it('submits a sale to its trusted branch endpoint', async () => {
    vi.mocked(request).mockResolvedValue({});
    const input = {
      clientTransactionId: 'client-transaction-id',
      items: [{ productId: 'product-id', quantity: 2 }],
      payments: [{ method: 'CASH' as const, amount: '900.00' }],
    };
    await checkoutSale(request, 'organization-id', 'branch-id', input);
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/branches/branch-id/pos/sales',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('lists and retrieves branch sales', async () => {
    vi.mocked(request).mockResolvedValue({});
    await listSales(request, 'organization-id', 'branch-id', {
      search: 'S-ABC',
      paymentMethod: 'GCASH',
      completedFrom: '2026-08-01T00:00:00.000Z',
      offset: 0,
      limit: 25,
    });
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/branches/branch-id/pos/sales?search=S-ABC&paymentMethod=GCASH&completedFrom=2026-08-01T00%3A00%3A00.000Z&offset=0&limit=25',
    );

    await getSale(request, 'organization-id', 'branch-id', 'sale-id');
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/organization-id/branches/branch-id/pos/sales/sale-id',
    );
  });
});
