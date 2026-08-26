import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import {
  adjustInventory,
  listInventory,
  listInventoryMovements,
  stockIn,
} from './inventory-api';

describe('inventory API', () => {
  const request = vi.fn() as unknown as AuthenticatedRequest;

  beforeEach(() => vi.clearAllMocks());

  it('lists a bounded inventory page with filters', async () => {
    vi.mocked(request).mockResolvedValue({});
    await listInventory(request, 'organization-id', {
      branchId: 'branch-id',
      search: 'woven pouch',
      offset: 25,
      limit: 25,
    });
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/inventory?branchId=branch-id&search=woven+pouch&offset=25&limit=25',
    );
  });

  it('lists movement history using its cursor', async () => {
    vi.mocked(request).mockResolvedValue({});
    await listInventoryMovements(request, 'organization-id', {
      type: 'ADJUSTMENT',
      cursor: 'movement-id',
      limit: 50,
    });
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/inventory/movements?type=ADJUSTMENT&cursor=movement-id&limit=50',
    );
  });

  it('records stock-in through the organization endpoint', async () => {
    vi.mocked(request).mockResolvedValue({});
    const input = {
      productId: 'product-id',
      branchId: 'branch-id',
      quantity: 8,
    };
    await stockIn(request, 'organization-id', input);
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/inventory/stock-in',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('records an explained adjustment', async () => {
    vi.mocked(request).mockResolvedValue({});
    const input = {
      productId: 'product-id',
      branchId: 'branch-id',
      quantityChange: -2,
      note: 'Physical count correction',
    };
    await adjustInventory(request, 'organization-id', input);
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/inventory/adjustments',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });
});
