import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import { listPosProducts, lookupPosProduct } from './pos-api';

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
});
