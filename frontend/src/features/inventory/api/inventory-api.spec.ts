import {
  adjustStock,
  createPlacement,
  getInventory,
  getInventoryBranch,
  getInventoryHealthSummary,
  getInventoryReconciliation,
  listInventory,
  listEligibleProducts,
  listMovements,
  receiveStock,
  updateInventoryPrice,
  updateInventoryThreshold,
} from './inventory-api';
import {
  branch,
  inventory,
  movement,
  movementHistory,
  scope,
} from '../model/inventory.test-fixtures';
import { product } from '@/features/products/model/product.test-fixtures';

const cursor = `${inventory.id}.${'a'.repeat(64)}`;

describe('Branch inventory API contracts', () => {
  const request = vi.fn();
  const base = `/organizations/${scope.organizationId}/branches/${scope.branchId}/inventory`;
  beforeEach(() => vi.resetAllMocks());
  it('scopes directory, detail, branch identity, and history reads', async () => {
    request
      .mockResolvedValueOnce({ items: [inventory], nextCursor: null })
      .mockResolvedValueOnce(inventory)
      .mockResolvedValueOnce(branch)
      .mockResolvedValueOnce({ items: [movementHistory], nextCursor: null });
    await listInventory(request, scope, {
      q: '001Ab',
      status: 'ACTIVE',
      stockStatus: 'LOW_STOCK',
    });
    expect(request).toHaveBeenLastCalledWith(
      `${base}?limit=5&q=001Ab&status=ACTIVE&stockStatus=LOW_STOCK`,
    );
    await expect(getInventory(request, scope)).resolves.toEqual(inventory);
    await expect(getInventoryBranch(request, scope)).resolves.toEqual(branch);
    await expect(listMovements(request, scope)).resolves.toEqual({
      items: [movementHistory],
      nextCursor: null,
    });
    expect(request).toHaveBeenLastCalledWith(
      `${base}/${scope.inventoryId}/movements?limit=5`,
    );
  });
  it('parses bounded inventory and eligible-product pages with cursors', async () => {
    request.mockResolvedValueOnce({ items: [inventory], nextCursor: cursor });
    await expect(listInventory(request, scope)).resolves.toEqual({
      items: [inventory],
      nextCursor: cursor,
    });
    request.mockResolvedValueOnce({ items: [], nextCursor: null });
    await listInventory(request, scope, { q: 'cup' }, cursor);
    expect(request).toHaveBeenLastCalledWith(
      `${base}?limit=5&q=cup&cursor=${encodeURIComponent(cursor)}`,
    );
    request.mockResolvedValueOnce({ items: [product], nextCursor: null });
    await expect(listEligibleProducts(request, scope, 'cup')).resolves.toEqual({
      items: [product],
      nextCursor: null,
    });
    expect(request).toHaveBeenLastCalledWith(
      `${base}/eligible-products?limit=5&q=cup`,
    );
    request.mockResolvedValueOnce({ items: [], nextCursor: 'bad' });
    await expect(listInventory(request, scope)).rejects.toThrow();
  });
  it('reads aggregate stock health without product details', async () => {
    const summary = { inStock: 3, lowStock: 2, outOfStock: 1 };
    request.mockResolvedValue(summary);
    await expect(getInventoryHealthSummary(request, scope)).resolves.toEqual(
      summary,
    );
    expect(request).toHaveBeenCalledWith(`${base}/summary`);
  });
  it('requests bounded older movement pages with a scoped cursor', async () => {
    request.mockResolvedValue({ items: [], nextCursor: null });
    await listMovements(request, scope, 'MANAGER', movement.id);
    expect(request).toHaveBeenCalledWith(
      `${base}/${scope.inventoryId}/movements?limit=5&cursor=${movement.id}`,
    );
  });
  it('reads bounded branch reconciliation pages and validates their contract', async () => {
    const mismatch = {
      inventoryId: scope.inventoryId,
      productId: inventory.productId,
      productName: inventory.product.name,
      sku: inventory.product.sku,
      recordedQuantity: 10,
      ledgerQuantity: '9',
      difference: '1',
    };
    const page = { items: [mismatch], nextCursor: scope.inventoryId };
    request.mockResolvedValue(page);
    await expect(getInventoryReconciliation(request, scope)).resolves.toEqual(
      page,
    );
    expect(request).toHaveBeenLastCalledWith(`${base}/reconciliation?limit=25`);
    await getInventoryReconciliation(request, scope, scope.inventoryId);
    expect(request).toHaveBeenLastCalledWith(
      `${base}/reconciliation?limit=25&cursor=${scope.inventoryId}`,
    );
    request.mockResolvedValue({
      items: [{ ...mismatch, ledgerQuantity: 9 }],
      nextCursor: null,
    });
    await expect(getInventoryReconciliation(request, scope)).rejects.toThrow();
  });
  it('placement submits opening stock while price updates remain quantity-free', async () => {
    request.mockResolvedValue(inventory);
    await createPlacement(request, scope, {
      productId: inventory.productId,
      sellingPrice: '925.50',
      initialQuantity: 10,
      lowStockThreshold: 5,
    });
    expect(request).toHaveBeenLastCalledWith(
      base,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          productId: inventory.productId,
          sellingPrice: '925.50',
          initialQuantity: 10,
          lowStockThreshold: 5,
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
    await updateInventoryThreshold(request, scope, 0);
    expect(request).toHaveBeenLastCalledWith(
      `${base}/${scope.inventoryId}/threshold`,
      expect.objectContaining({
        method: 'PATCH',
        body: '{"lowStockThreshold":0}',
      }),
    );
  });
  it('accepts actor-free merchant history and strips actor fields defensively', async () => {
    const { actorName, ...own } = movementHistory;
    expect(actorName).toBe('Maria Santos');
    request.mockResolvedValue({ items: [own], nextCursor: null });
    await expect(listMovements(request, scope, 'MERCHANT')).resolves.toEqual({
      items: [own],
      nextCursor: null,
    });
    request.mockResolvedValue({
      items: [{ ...own, actorName }],
      nextCursor: null,
    });
    await expect(listMovements(request, scope, 'MERCHANT')).resolves.toEqual({
      items: [own],
      nextCursor: null,
    });
    request.mockResolvedValue({
      items: [{ ...own, quantityChange: 0 }],
      nextCursor: null,
    });
    await expect(listMovements(request, scope, 'MERCHANT')).rejects.toThrow();
  });
  it('accepts identity-only selling branches for merchants', async () => {
    const identity = { id: branch.id, name: branch.name, code: branch.code };
    request.mockResolvedValue(identity);
    await expect(getInventoryBranch(request, scope)).resolves.toEqual(identity);
  });
  it('accepts sale deductions without exposing internal sale-item links', async () => {
    const sale = { ...movementHistory, type: 'SALE', quantityChange: -1 };
    request.mockResolvedValue({
      items: [{ ...sale, saleItemId: 'private-link' }],
      nextCursor: null,
    });
    await expect(listMovements(request, scope)).resolves.toEqual({
      items: [sale],
      nextCursor: null,
    });
    const { actorName, ...own } = sale;
    expect(actorName).toBe('Maria Santos');
    await expect(listMovements(request, scope, 'MERCHANT')).resolves.toEqual({
      items: [own],
      nextCursor: null,
    });
  });
  it('preserves request IDs and integer deltas without submitting actor or tenant fields', async () => {
    request.mockResolvedValue(movement);
    const receipt = {
      quantity: 3,
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
    await adjustStock(request, scope, {
      newQuantity: 8,
      reason: 'Correction',
      requestId: movement.requestId,
    });
    expect(request).toHaveBeenLastCalledWith(
      `${base}/${scope.inventoryId}/adjustments`,
      expect.objectContaining({
        body: JSON.stringify({
          newQuantity: 8,
          reason: 'Correction',
          requestId: movement.requestId,
        }),
      }),
    );
  });
  it('accepts positive returns while stripping private links and merchant actors', async () => {
    const returned = { ...movementHistory, type: 'RETURN', quantityChange: 1 };
    request.mockResolvedValue({
      items: [{ ...returned, refundItemId: 'private-link' }],
      nextCursor: null,
    });
    await expect(listMovements(request, scope)).resolves.toEqual({
      items: [returned],
      nextCursor: null,
    });
    const { actorName, ...own } = returned;
    expect(actorName).toBe('Maria Santos');
    await expect(listMovements(request, scope, 'MERCHANT')).resolves.toEqual({
      items: [own],
      nextCursor: null,
    });
    request.mockResolvedValue({
      items: [{ ...returned, quantityChange: -1 }],
      nextCursor: null,
    });
    await expect(listMovements(request, scope)).rejects.toThrow();
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
    { type: 'REFUND' },
    { type: 'SALE', quantityChange: 1 },
  ])('rejects invalid movement responses %j', async (extra) => {
    request.mockResolvedValue({
      items: [{ ...movement, ...extra }],
      nextCursor: null,
    });
    await expect(listMovements(request, scope)).rejects.toThrow();
  });
});
