import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PosCatalogService, posCatalogSelect } from './pos-catalog.service';

describe('PosCatalogService', () => {
  const prisma = {
    branch: { findFirst: jest.fn() },
    branchInventory: { findMany: jest.fn() },
  };
  const service = new PosCatalogService(prisma as unknown as PrismaService);
  const context = {
    organizationId: 'org',
    userId: 'actor',
    role: 'CASHIER' as const,
  };
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch' });
    prisma.branchInventory.findMany.mockResolvedValue([]);
  });
  it('bounds and orders search, projecting only approved fields with current assignment scope', async () => {
    await service.findAll(context, 'branch', '001Ab');
    expect(prisma.branchInventory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 16,
        select: posCatalogSelect,
        orderBy: [{ product: { name: 'asc' } }, { id: 'asc' }],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          organizationId: 'org',
          branchId: 'branch',
          branch: {
            organizationId: 'org',
            memberships: { some: { organizationId: 'org', userId: 'actor' } },
          },
        }),
      }),
    );
  });
  it('compares uppercase SKU and unchanged barcode without a first-match limit', async () => {
    await service.findByCode(context, 'branch', '001Ab');
    const calls = prisma.branchInventory.findMany.mock.calls as unknown as [
      { take?: number; where: { product: { AND: unknown[] } } },
    ][];
    const query = calls[0][0];
    expect(query.take).toBeUndefined();
    expect(query.where.product.AND[1]).toEqual({
      OR: [{ sku: '001AB' }, { barcode: '001Ab' }],
    });
  });
  it('does not query catalog for an absent or inaccessible branch', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);
    await expect(service.findAll(context, 'branch')).rejects.toThrow(
      'Branch not found',
    );
    expect(prisma.branchInventory.findMany).not.toHaveBeenCalled();
  });

  it('returns a validated continuation cursor and applies it to the next read', async () => {
    const row = (id: string, name: string) => ({
      id,
      sellingPrice: { toFixed: () => '10.00' },
      quantity: 1,
      merchantBranch: { status: 'ACTIVE' },
      product: {
        id: `product-${id}`,
        name,
        sku: null,
        barcode: null,
        merchant: { name: 'Merchant' },
      },
    });
    prisma.branchInventory.findMany.mockResolvedValueOnce(
      Array.from({ length: 16 }, (_, index) =>
        row(`inventory-${index}`, `Product ${String(index).padStart(2, '0')}`),
      ),
    );

    const first = await service.findAll(context, 'branch', '  product ');

    expect(first.items).toHaveLength(15);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toEqual(expect.any(String));

    prisma.branchInventory.findMany.mockResolvedValueOnce([]);
    await service.findAll(context, 'branch', 'product', first.nextCursor!);

    expect(prisma.branchInventory.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        // Prisma's generated where input is intentionally structural here.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          AND: [
            {
              OR: [
                { product: { name: { gt: 'Product 14' } } },
                {
                  AND: [
                    { product: { name: 'Product 14' } },
                    { id: { gt: 'inventory-14' } },
                  ],
                },
              ],
            },
          ],
        }),
      }),
    );
  });
});
