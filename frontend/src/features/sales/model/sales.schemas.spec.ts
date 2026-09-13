import {
  merchantSaleSchema,
  merchantSalesPageSchema,
  salesQuerySchema,
} from './sales.schemas';
import { ownSale, ownPage } from './sales.test-fixtures';
describe('historical own-sale schema invariants', () => {
  it('retains precise own-item amounts across the maximum 100-line checkout capacity', () => {
    const items = Array.from({ length: 100 }, (_, index) => ({
      ...ownSale.items[0],
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      quantity: 2147483647,
      unitPrice: '9999999999.99',
      lineTotal: '21474836469978525163.53',
    }));
    const sale = {
      ...ownSale,
      items,
      ownItemsSubtotal: '2147483646997852516353.00',
    };
    expect(merchantSaleSchema.parse(sale)).toEqual(sale);
    expect(
      merchantSaleSchema.safeParse({
        ...sale,
        ownItemsSubtotal: '2147483646997852516353.01',
      }).success,
    ).toBe(false);
  });
  it('rejects malformed, duplicate or nonpositive own item values without throwing during safeParse', () => {
    for (const changes of [
      { unitPrice: '1e3' },
      { lineTotal: 'NaN' },
      { unitPrice: '0.00', lineTotal: '0.00' },
      { quantity: 0 },
      { quantity: 2147483648 },
    ])
      expect(
        merchantSaleSchema.safeParse({
          ...ownSale,
          items: [{ ...ownSale.items[0], ...changes }],
        }).success,
      ).toBe(false);
    expect(
      merchantSaleSchema.safeParse({
        ...ownSale,
        items: [ownSale.items[0], ownSale.items[0]],
        ownItemsSubtotal: '1700.00',
      }).success,
    ).toBe(false);
  });
  it('supports unlinked/assigned empty lists and out-of-range pages without misleading counts', () => {
    expect(
      merchantSalesPageSchema.parse({
        ...ownPage,
        items: [],
        total: 0,
        totalPages: 0,
      }).items,
    ).toEqual([]);
    expect(
      merchantSalesPageSchema.parse({ ...ownPage, page: 2, items: [] }).items,
    ).toEqual([]);
    expect(
      merchantSalesPageSchema.safeParse({ ...ownPage, items: [] }).success,
    ).toBe(false);
  });
  it('accepts strict UTC fractional timestamps and rejects reversed/equal ranges', () => {
    expect(
      salesQuerySchema.safeParse({
        page: 1,
        limit: 100,
        from: '2026-09-13T00:00:00.1Z',
        until: '2026-09-13T00:00:00.123Z',
      }).success,
    ).toBe(true);
    expect(
      salesQuerySchema.safeParse({
        page: 1,
        limit: 50,
        from: '2026-09-13T00:00:00Z',
        until: '2026-09-13T00:00:00Z',
      }).success,
    ).toBe(false);
  });
});
