import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import {
  createProduct,
  listProducts,
  lookupProduct,
  updateProductStatus,
} from './product-api';

describe('product API', () => {
  const request = vi.fn() as unknown as AuthenticatedRequest;

  beforeEach(() => vi.clearAllMocks());

  it('lists products with encoded tenant-scoped filters', async () => {
    vi.mocked(request).mockResolvedValue([]);
    await listProducts(request, 'organization/id', {
      search: 'woven pouch',
      merchantId: 'merchant-id',
      status: 'ACTIVE',
    });
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%2Fid/products?search=woven+pouch&merchantId=merchant-id&status=ACTIVE',
    );
  });

  it('looks up an exact SKU or barcode', async () => {
    vi.mocked(request).mockResolvedValue({});
    await lookupProduct(request, 'organization-id', 'AMH/01');
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/products/lookup?code=AMH%2F01',
    );
  });

  it('creates a merchant-owned product', async () => {
    vi.mocked(request).mockResolvedValue({});
    const input = {
      merchantId: 'merchant-id',
      name: 'Handwoven pouch',
      sku: 'AMH-01',
      sellingPrice: '450.00',
    };
    await createProduct(request, 'organization-id', input);
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/products',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('updates status through the dedicated endpoint', async () => {
    vi.mocked(request).mockResolvedValue({});
    await updateProductStatus(
      request,
      'organization-id',
      'product/id',
      'INACTIVE',
    );
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/products/product%2Fid/status',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'INACTIVE' }),
      }),
    );
  });
});
