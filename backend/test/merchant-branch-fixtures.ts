/** Existing operation fixtures explicitly establish branch participation before stocking.
 * Keep negative affiliation tests on the real services, without these fixture helpers.
 */
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { BranchInventoryService } from '../src/modules/organizations/inventory/branch-inventory.service';
import { ProductsService } from '../src/modules/organizations/products/products.service';
async function affiliate(
  db: PrismaClient,
  organizationId: string,
  branchId: string,
  merchantId: string,
) {
  const [branch, merchant] = await Promise.all([
    db.branch.findFirst({ where: { id: branchId, organizationId } }),
    db.merchant.findFirst({ where: { id: merchantId, organizationId } }),
  ]);
  if (branch && merchant)
    await db.merchantBranch.upsert({
      where: {
        organizationId_branchId_merchantId: {
          organizationId,
          branchId,
          merchantId,
        },
      },
      create: { organizationId, branchId, merchantId },
      update: {},
    });
}
export async function fixturePlace(
  service: BranchInventoryService,
  db: PrismaClient,
  ...args: Parameters<BranchInventoryService['create']>
) {
  const product = await db.product.findUnique({
    where: { id: args[2].productId },
  });
  if (product) await affiliate(db, args[0], args[1], product.merchantId);
  return service.create(...args);
}
export async function fixtureProduct(
  service: ProductsService,
  db: PrismaClient,
  ...args: Parameters<ProductsService['create']>
) {
  if (args[1].initialInventory)
    await affiliate(
      db,
      args[0],
      args[1].initialInventory.branchId,
      args[1].merchantId,
    );
  return service.create(...args);
}
type PlacementData = Omit<
  Prisma.BranchInventoryUncheckedCreateInput,
  'merchantId'
> & { merchantId?: string };
export async function fixtureInventory(
  db: PrismaClient,
  args: { data: PlacementData },
) {
  const product = await db.product.findUnique({
    where: { id: args.data.productId },
  });
  const merchantId = args.data.merchantId ?? product?.merchantId ?? 'missing';
  await affiliate(db, args.data.organizationId, args.data.branchId, merchantId);
  return db.branchInventory.create({ data: { ...args.data, merchantId } });
}
export async function fixtureInventoryMany(
  db: PrismaClient,
  args: { data: PlacementData[] },
) {
  const data = [];
  for (const row of args.data) {
    const product = await db.product.findUnique({
      where: { id: row.productId },
    });
    const merchantId = row.merchantId ?? product?.merchantId ?? 'missing';
    await affiliate(db, row.organizationId, row.branchId, merchantId);
    data.push({ ...row, merchantId });
  }
  return db.branchInventory.createMany({ data });
}
