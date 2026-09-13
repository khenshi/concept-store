import {
  adjustStock,
  createPlacement,
  getInventory,
  getInventoryBranch,
  listInventory,
  listMovements,
  receiveStock,
  updateInventoryPrice,
} from './inventory-api';
import {
  branch,
  inventory,
  movement,
  scope,
} from '../model/inventory.test-fixtures';

describe('Branch inventory API contracts', () => {
  const request = vi.fn();
  const base = `/organizations/${scope.organizationId}/branches/${scope.branchId}/inventory`;
  beforeEach(() => vi.resetAllMocks());
  it('scopes directory, detail, branch identity, and history reads', async () => {
    request
      .mockResolvedValueOnce([inventory])
      .mockResolvedValueOnce(inventory)
      .mockResolvedValueOnce(branch)
      .mockResolvedValueOnce([movement]);
    await listInventory(request, scope, { q: '001Ab', status: 'ACTIVE' });
    expect(request).toHaveBeenLastCalledWith(`${base}?q=001Ab&status=ACTIVE`);
    await expect(getInventory(request, scope)).resolves.toEqual(inventory);
    await expect(getInventoryBranch(request, scope)).resolves.toEqual(branch);
    await expect(listMovements(request, scope)).resolves.toEqual([movement]);
    expect(request).toHaveBeenLastCalledWith(
      `${base}/${scope.inventoryId}/movements`,
    );
  });
  it('placement and price commands never submit stock quantities', async () => {
    request.mockResolvedValue(inventory);
    await createPlacement(request, scope, {
      productId: inventory.productId,
      sellingPrice: '925.50',
    });
    expect(request).toHaveBeenLastCalledWith(
      base,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          productId: inventory.productId,
          sellingPrice: '925.50',
        }),
      }),
    );
    await updateInventoryPrice(request, scope, '0.01');
    expect(request).toHaveBeenLastCalledWith(
      `${base}/${scope.inventoryId}/price`,
      expect.objectContaining({
        method: 'PATCH',
        body: '{"sellingPrice":"0.01"}',
      }),
    );
  });
  it('accepts actor-free merchant history and strips actor fields defensively', async () => {
    const { createdById, ...own } = movement;
    request.mockResolvedValue([own]);
    await expect(listMovements(request, scope, 'MERCHANT')).resolves.toEqual([
      own,
    ]);
    request.mockResolvedValue([{ ...own, createdById }]);
    await expect(listMovements(request, scope, 'MERCHANT')).resolves.toEqual([
      own,
    ]);
    request.mockResolvedValue([{ ...own, quantityChange: 0 }]);
    await expect(listMovements(request, scope, 'MERCHANT')).rejects.toThrow();
  });
  it('accepts identity-only selling branches for merchants', async () => {
    const identity = { id: branch.id, name: branch.name, code: branch.code };
    request.mockResolvedValue(identity);
    await expect(getInventoryBranch(request, scope)).resolves.toEqual(identity);
  });
  it('preserves request IDs and integer deltas without submitting actor or tenant fields', async () => {
    request.mockResolvedValue(movement);
    const receipt = {
      quantity: 3,
      reason: 'Delivery',
      requestId: movement.requestId,
    };
    await receiveStock(request, scope, receipt);
    expect(request).toHaveBeenLastCalledWith(
      `${base}/${scope.inventoryId}/receipts`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(receipt),
      }),
    );
    await adjustStock(request, scope, {
      quantityChange: -2,
      reason: 'Correction',
      requestId: movement.requestId,
    });
    expect(request).toHaveBeenLastCalledWith(
      `${base}/${scope.inventoryId}/adjustments`,
      expect.objectContaining({
        body: JSON.stringify({
          quantityChange: -2,
          reason: 'Correction',
          requestId: movement.requestId,
        }),
      }),
    );
  });
  it.each([
    { quantity: -1 },
    { sellingPrice: 850 },
    { product: { ...inventory.product, status: 'UNKNOWN' } },
  ])('rejects malformed inventory responses %j', async (extra) => {
    request.mockResolvedValue({ ...inventory, ...extra });
    await expect(getInventory(request, scope)).rejects.toThrow();
  });
  it.each([
    { quantityChange: 0 },
    { quantityChange: -1 },
    { quantityAfter: -1 },
    { type: 'SALE' },
  ])('rejects invalid movement responses %j', async (extra) => {
    request.mockResolvedValue([{ ...movement, ...extra }]);
    await expect(listMovements(request, scope)).rejects.toThrow();
  });
});
