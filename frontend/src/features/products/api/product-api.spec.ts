import {
  createProduct,
  getProduct,
  getProductPlacements,
  listProducts,
  updateProduct,
  updateProductStatus,
} from './product-api';
import {
  merchant,
  organizationId,
  placement,
  product,
} from '../model/product.test-fixtures';

describe('Product API contracts', () => {
  it('sends opening stock in one product-create request and strips private response metadata', async () => {
    const request = vi.fn().mockResolvedValue({
      ...product,
      creationCommand: { secret: true },
      creationActorId: merchant.id,
      creationRequestId: product.id,
    });
    const input = {
      merchantId: merchant.id,
      name: product.name,
      sku: null,
      barcode: null,
      requestId: product.id,
      initialInventory: {
        branchId: placement.branchId,
        sellingPrice: '0.01',
        quantity: 1,
        lowStockThreshold: 5,
      },
    };
    await expect(
      createProduct(request, organizationId, input),
    ).resolves.toEqual(product);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      `/organizations/${organizationId}/products`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });
  const request = vi.fn();
  beforeEach(() => vi.resetAllMocks());
  it('encodes search/filter values and validates directory responses', async () => {
    request.mockResolvedValue([product]);
    await expect(
      listProducts(request, organizationId, {
        q: 'Vase & tray',
        merchantId: merchant.id,
        status: 'ACTIVE',
      }),
    ).resolves.toEqual([product]);
    expect(request.mock.calls[0][0]).toBe(
      `/organizations/${organizationId}/products?q=Vase+%26+tray&merchantId=${merchant.id}&status=ACTIVE`,
    );
    request.mockResolvedValue([{ ...product, status: 'DELETED' }]);
    await expect(listProducts(request, organizationId)).rejects.toThrow();
  });
  it('retrieves product and independent precise placements', async () => {
    request.mockResolvedValueOnce(product).mockResolvedValueOnce([placement]);
    await expect(
      getProduct(request, organizationId, product.id),
    ).resolves.toEqual(product);
    await expect(
      getProductPlacements(request, organizationId, product.id),
    ).resolves.toEqual([placement]);
    expect(request).toHaveBeenLastCalledWith(
      `/organizations/${organizationId}/products/${product.id}/inventory`,
    );
    request.mockResolvedValue([{ ...placement, sellingPrice: 850 }]);
    await expect(
      getProductPlacements(request, organizationId, product.id),
    ).rejects.toThrow();
  });
  it('keeps create, profile, and status request contracts separate', async () => {
    request.mockResolvedValue(product);
    const identity = { name: product.name, sku: null, barcode: '001Ab' };
    await createProduct(request, organizationId, {
      ...identity,
      merchantId: merchant.id,
    });
    expect(request).toHaveBeenLastCalledWith(
      `/organizations/${organizationId}/products`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ ...identity, merchantId: merchant.id }),
      }),
    );
    await updateProduct(request, organizationId, product.id, identity);
    expect(request).toHaveBeenLastCalledWith(
      `/organizations/${organizationId}/products/${product.id}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(identity),
      }),
    );
    await updateProductStatus(request, organizationId, product.id, 'INACTIVE');
    expect(request).toHaveBeenLastCalledWith(
      `/organizations/${organizationId}/products/${product.id}/status`,
      expect.objectContaining({
        method: 'PATCH',
        body: '{"status":"INACTIVE"}',
      }),
    );
  });
  it('encodes identifiers without creating new path segments', async () => {
    request.mockResolvedValue(product);
    await getProduct(request, 'org/unsafe', 'item/unsafe');
    expect(request).toHaveBeenCalledWith(
      '/organizations/org%2Funsafe/products/item%2Funsafe',
    );
  });
});
