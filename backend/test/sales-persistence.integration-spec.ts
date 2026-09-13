import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { BranchInventoryService } from '../src/modules/organizations/inventory/branch-inventory.service';
import { PosCatalogService } from '../src/modules/organizations/pos/pos-catalog.service';
import { CheckoutService } from '../src/modules/organizations/sales/checkout.service';
import type { CheckoutDto } from '../src/modules/organizations/sales/dto/checkout.dto';
import { InventoryStockService } from '../src/modules/organizations/inventory/inventory-stock.service';
import { SalesReadService } from '../src/modules/organizations/sales/sales-read.service';
import { ListSalesQueryDto } from '../src/modules/organizations/sales/dto/list-sales-query.dto';
import type { OrganizationContext } from '../src/modules/organizations/authorization/organization-authorization.types';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString)
  throw new Error(
    'Set TEST_DATABASE_URL to an explicitly disposable PostgreSQL test database',
  );
const schema = `sales_test_${randomUUID().replaceAll('-', '')}`;
const admin = new Client({ connectionString });
const prisma = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString, options: `-c search_path=${schema}` },
    { schema },
  ),
});
let organizationId: string;
let branchId: string;
let otherBranchId: string;
let merchantId: string;
let otherMerchantId: string;
let productId: string;
let inventoryId: string;
let userId: string;

const saleData = (
  extra: Partial<Prisma.SaleUncheckedCreateInput> = {},
): Prisma.SaleUncheckedCreateInput => ({
  organizationId,
  branchId,
  receiptCode: randomUUID(),
  requestId: randomUUID(),
  createdById: userId,
  paymentMethod: 'CASH',
  cashTender: '30.00',
  cashChange: '5.00',
  total: '25.00',
  organizationName: 'Original store',
  branchName: 'Original branch',
  branchCode: 'ONE',
  cashierName: 'Original actor',
  checkoutCommand: {
    items: [
      {
        branchInventoryId: inventoryId,
        quantity: 2,
        expectedUnitPrice: '12.50',
      },
    ],
    paymentMethod: 'CASH',
    cashTender: '30.00',
  },
  ...extra,
});
const itemData = (
  saleId: string,
  extra: Partial<Prisma.SaleItemUncheckedCreateInput> = {},
): Prisma.SaleItemUncheckedCreateInput => ({
  organizationId,
  branchId,
  saleId,
  branchInventoryId: inventoryId,
  productId,
  merchantId,
  quantity: 2,
  productName: 'Original product',
  sku: 'ORIGINAL',
  barcode: '001Ab',
  merchantName: 'Original merchant',
  unitPrice: '12.50',
  lineTotal: '25.00',
  ...extra,
});
const movementData = (
  saleItemId: string,
  extra: Partial<Prisma.InventoryMovementUncheckedCreateInput> = {},
): Prisma.InventoryMovementUncheckedCreateInput => ({
  organizationId,
  branchId,
  branchInventoryId: inventoryId,
  saleItemId,
  type: 'SALE',
  quantityChange: -2,
  quantityAfter: 3,
  reason: 'Point-of-sale checkout',
  createdById: userId,
  requestId: randomUUID(),
  ...extra,
});

describe('PostgreSQL sale persistence integrity', () => {
  const salesReads = new SalesReadService(prisma as unknown as PrismaService);
  const salesMember = async (
    role: OrganizationContext['role'],
    link: string | null = null,
  ): Promise<OrganizationContext> => {
    const user = await prisma.user.create({
      data: {
        firstName: 'Sales',
        lastName: 'Member',
        email: `${randomUUID()}@example.test`,
        passwordHash: 'unused',
      },
    });
    await prisma.organizationMembership.create({
      data: { organizationId, userId: user.id, role, merchantId: link },
    });
    return { organizationId, userId: user.id, role, merchantId: link };
  };
  const fixtureSale = async (
    extra: Partial<Prisma.SaleUncheckedCreateInput> = {},
  ) => {
    const sale = await prisma.sale.create({ data: saleData(extra) });
    await prisma.saleItem.create({ data: itemData(sale.id) });
    return sale;
  };
  it('scopes staff list/detail by current assignments, cashier actor, tenant and branch', async () => {
    const owner = await salesMember('OWNER');
    const cashier = await salesMember('CASHIER');
    const manager = await salesMember('MANAGER');
    const own = await fixtureSale({ createdById: cashier.userId });
    const other = await fixtureSale();
    await expect(
      salesReads.findAll(cashier, branchId, new ListSalesQueryDto()),
    ).rejects.toThrow('Branch not found');
    await prisma.branchMembership.createMany({
      data: [cashier, manager].map((context) => ({
        organizationId,
        branchId,
        userId: context.userId,
      })),
    });
    const page = await salesReads.findAll(
      cashier,
      branchId,
      new ListSalesQueryDto(),
    );
    expect(page.total).toBe(1);
    expect(page.items.map((row) => row.id)).toEqual([own.id]);
    expect(
      (await salesReads.findAll(manager, branchId, new ListSalesQueryDto()))
        .total,
    ).toBe(2);
    expect(
      (await salesReads.findAll(owner, branchId, new ListSalesQueryDto()))
        .total,
    ).toBe(2);
    await expect(
      salesReads.findOne(cashier, branchId, other.id),
    ).rejects.toThrow('Sale not found');
    await expect(
      salesReads.findOne(owner, otherBranchId, own.id),
    ).rejects.toThrow('Sale not found');
    await expect(
      salesReads.findOne(
        { ...owner, organizationId: randomUUID() },
        branchId,
        own.id,
      ),
    ).rejects.toThrow('Organization not found');
    await prisma.branchMembership.deleteMany({
      where: { organizationId, userId: cashier.userId },
    });
    await expect(salesReads.findOne(cashier, branchId, own.id)).rejects.toThrow(
      'Branch not found',
    );
    await prisma.organizationMembership.update({
      where: {
        organizationId_userId: { organizationId, userId: owner.userId },
      },
      data: { role: 'CASHIER' },
    });
    await expect(salesReads.findOne(owner, branchId, own.id)).rejects.toThrow(
      'Branch not found',
    );
  });
  it('projects mixed sales to historical own items/subtotal and discovers selling branches without assignments', async () => {
    const merchant = await salesMember('MERCHANT', merchantId);
    const colleague = await salesMember('MERCHANT', merchantId);
    const secondProduct = await prisma.product.create({
      data: {
        organizationId,
        merchantId: otherMerchantId,
        name: 'Other merchant goods',
      },
    });
    const second = await prisma.branchInventory.create({
      data: {
        organizationId,
        branchId,
        productId: secondProduct.id,
        sellingPrice: '0.01',
      },
    });
    const sale = await fixtureSale({
      total: '25.02',
      cashTender: '30.00',
      cashChange: '4.98',
    });
    await prisma.saleItem.create({
      data: itemData(sale.id, {
        branchInventoryId: second.id,
        productId: secondProduct.id,
        merchantId: otherMerchantId,
        merchantName: 'Other merchant',
        productName: 'Other merchant goods',
        unitPrice: '0.01',
        lineTotal: '0.02',
      }),
    });
    const own = await salesReads.findOne(merchant, branchId, sale.id);
    expect(Object.keys(own).sort()).toEqual(
      [
        'id',
        'receiptCode',
        'completedAt',
        'branchId',
        'branchName',
        'branchCode',
        'items',
        'ownItemsSubtotal',
      ].sort(),
    );
    expect(own).toMatchObject({
      ownItemsSubtotal: '25.00',
      items: [
        {
          productName: 'Original product',
          unitPrice: '12.50',
          lineTotal: '25.00',
          quantity: 2,
        },
      ],
    });
    expect(own.items).toHaveLength(1);
    expect(Object.keys(own.items[0]).sort()).toEqual(
      [
        'id',
        'productId',
        'productName',
        'sku',
        'barcode',
        'merchantName',
        'quantity',
        'unitPrice',
        'lineTotal',
      ].sort(),
    );
    expect(await salesReads.findOne(colleague, branchId, sale.id)).toEqual(own);
    expect(
      await salesReads.findOne(
        { ...merchant, role: 'OWNER', merchantId: otherMerchantId },
        branchId,
        sale.id,
      ),
    ).toEqual(own);
    expect(await salesReads.sellingBranches(merchant)).toEqual([
      { id: branchId, name: 'Original branch', code: 'ONE' },
    ]);
    await prisma.product.update({
      where: { id: productId },
      data: { status: 'INACTIVE', name: 'Changed' },
    });
    await prisma.merchant.update({
      where: { id: merchantId },
      data: { status: 'ENDED', name: 'Changed' },
    });
    await prisma.branch.update({
      where: { id: branchId },
      data: { name: 'Renamed branch' },
    });
    expect(await salesReads.findOne(merchant, branchId, sale.id)).toEqual(own);
    expect(await salesReads.sellingBranches(merchant)).toEqual([
      { id: branchId, name: 'Renamed branch', code: 'ONE' },
    ]);
    const page = await salesReads.findAll(
      merchant,
      branchId,
      new ListSalesQueryDto(),
    );
    expect(page.total).toBe(1);
    expect(page.items).toEqual([own]);
    await prisma.organizationMembership.update({
      where: {
        organizationId_userId: { organizationId, userId: merchant.userId },
      },
      data: { merchantId: otherMerchantId },
    });
    expect(await salesReads.findOne(merchant, branchId, sale.id)).toMatchObject(
      {
        ownItemsSubtotal: '0.02',
        items: [{ productName: 'Other merchant goods' }],
      },
    );
    expect(await salesReads.findOne(colleague, branchId, sale.id)).toEqual(own);
  });
  it('keeps unlinked and unrelated merchants empty, even with explicit assignments, and denies detail guesses', async () => {
    const sale = await fixtureSale();
    const unlinked = await salesMember('MERCHANT');
    const unrelated = await salesMember('MERCHANT', otherMerchantId);
    await expect(
      salesReads.findAll(unlinked, branchId, new ListSalesQueryDto()),
    ).rejects.toThrow('Branch not found');
    await expect(
      salesReads.findAll(unrelated, branchId, new ListSalesQueryDto()),
    ).rejects.toThrow('Branch not found');
    await prisma.branchMembership.createMany({
      data: [unlinked, unrelated].map((context) => ({
        organizationId,
        branchId,
        userId: context.userId,
      })),
    });
    for (const context of [unlinked, unrelated]) {
      expect(
        await salesReads.findAll(context, branchId, new ListSalesQueryDto()),
      ).toEqual({ items: [], page: 1, limit: 50, total: 0, totalPages: 0 });
      expect(await salesReads.sellingBranches(context)).toEqual([]);
      await expect(
        salesReads.findOne(context, branchId, sale.id),
      ).rejects.toThrow('Sale not found');
      await expect(
        salesReads.findOne(context, branchId, randomUUID()),
      ).rejects.toThrow('Sale not found');
      await expect(
        salesReads.findAll(context, randomUUID(), new ListSalesQueryDto()),
      ).rejects.toThrow('Branch not found');
    }
    const owner = await salesMember('OWNER');
    await expect(salesReads.sellingBranches(owner)).rejects.toThrow(
      'Only merchants',
    );
  });
  it('paginates only matching sales in stable completion/ID order with a half-open UTC range', async () => {
    const merchant = await salesMember('MERCHANT', merchantId);
    const first = await fixtureSale({
      completedAt: new Date('2026-09-13T00:00:00Z'),
    });
    const second = await fixtureSale({
      completedAt: new Date('2026-09-13T01:00:00Z'),
    });
    const third = await fixtureSale({
      completedAt: new Date('2026-09-13T01:00:00Z'),
    });
    await prisma.sale.create({
      data: saleData({ completedAt: new Date('2026-09-13T01:30:00Z') }),
    });
    const query = {
      ...new ListSalesQueryDto(),
      limit: 1,
      from: '2026-09-13T01:00:00Z',
      until: '2026-09-13T02:00:00Z',
    };
    const sorted = [second.id, third.id].sort().reverse();
    const page = await salesReads.findAll(merchant, branchId, query);
    expect(page).toMatchObject({ total: 2, totalPages: 2, page: 1, limit: 1 });
    expect(page.items.map((row) => row.id)).toEqual([sorted[0]]);
    expect(
      (
        await salesReads.findAll(merchant, branchId, { ...query, page: 2 })
      ).items.map((row) => row.id),
    ).toEqual([sorted[1]]);
    expect(
      (await salesReads.findAll(merchant, branchId, { ...query, page: 3 }))
        .items,
    ).toEqual([]);
    expect(
      (
        await salesReads.findAll(merchant, branchId, {
          ...query,
          from: '2026-09-13T00:00:00Z',
          until: '2026-09-13T01:00:00Z',
        })
      ).items.map((row) => row.id),
    ).toEqual([first.id]);
    await expect(
      salesReads.findAll(merchant, branchId, { ...query, until: query.from }),
    ).rejects.toThrow('from must precede until');
  });
  const checkout = new CheckoutService(prisma as unknown as PrismaService);
  const checkoutSetup = async () => {
    await prisma.organizationMembership.create({
      data: { organizationId, userId, role: 'OWNER' },
    });
    return { organizationId, userId, role: 'OWNER' as const };
  };
  const checkoutCommand = (extra: Partial<CheckoutDto> = {}): CheckoutDto => ({
    requestId: randomUUID(),
    items: [
      {
        branchInventoryId: inventoryId,
        quantity: 2,
        expectedUnitPrice: '12.50',
      },
    ],
    paymentMethod: 'CASH',
    cashTender: '50.00',
    ...extra,
  });
  it.each(['CASH', 'GCASH', 'CARD'] as const)(
    'atomically checks out %s with precise payment snapshots and a matching ledger',
    async (paymentMethod) => {
      const context = await checkoutSetup();
      const command = checkoutCommand(
        paymentMethod === 'CASH'
          ? {}
          : {
              paymentMethod,
              cashTender: undefined,
              paymentReference: 'manual-reference',
            },
      );
      const result = await checkout.complete(context, branchId, command);
      expect(result).toMatchObject({
        total: '25.00',
        paymentMethod,
        organizationName: (
          await prisma.organization.findUniqueOrThrow({
            where: { id: organizationId },
          })
        ).name,
        cashierName: 'Original actor',
        items: [
          {
            productName: 'Original product',
            merchantName: 'Original merchant',
            quantity: 2,
            unitPrice: '12.50',
            lineTotal: '25.00',
          },
        ],
      });
      expect(result).not.toHaveProperty('requestId');
      expect(result).not.toHaveProperty('checkoutCommand');
      expect(result).not.toHaveProperty('createdById');
      expect(result.cashTender).toBe(paymentMethod === 'CASH' ? '50.00' : null);
      expect(result.cashChange).toBe(paymentMethod === 'CASH' ? '25.00' : null);
      const movement = await prisma.inventoryMovement.findFirstOrThrow({
        where: { organizationId, type: 'SALE' },
      });
      expect(movement).toMatchObject({
        saleItemId: result.items[0].id,
        quantityChange: -2,
        quantityAfter: 3,
        createdById: userId,
        reason: 'Point-of-sale checkout',
      });
      expect(
        (
          await prisma.branchInventory.findUniqueOrThrow({
            where: { id: inventoryId },
          })
        ).quantity,
      ).toBe(3);
    },
  );
  it('replays normalized commands before current price/lifecycle/stock checks and rejects changed commands', async () => {
    const context = await checkoutSetup();
    const command = checkoutCommand();
    const result = await checkout.complete(context, branchId, command);
    await new InventoryStockService(prisma as unknown as PrismaService).adjust(
      organizationId,
      branchId,
      inventoryId,
      userId,
      {
        quantityChange: -3,
        reason: 'Remaining stock correction',
        requestId: randomUUID(),
      },
    );
    await prisma.branchInventory.update({
      where: { id: inventoryId },
      data: { sellingPrice: '99.00' },
    });
    await prisma.product.update({
      where: { id: productId },
      data: { status: 'INACTIVE', name: 'Renamed' },
    });
    expect(
      await checkout.complete(context, branchId, {
        ...command,
        cashTender: '50',
        items: [{ ...command.items[0], expectedUnitPrice: '12.5' }],
      }),
    ).toEqual(result);
    await expect(
      checkout.complete(context, branchId, { ...command, cashTender: '51' }),
    ).rejects.toThrow('Request ID');
    expect(await prisma.sale.count({ where: { organizationId } })).toBe(1);
    expect(
      await prisma.inventoryMovement.count({
        where: { organizationId, type: 'SALE' },
      }),
    ).toBe(1);
  });
  it('checks fresh roles, memberships, branch assignments and original actor on replay', async () => {
    const context = await checkoutSetup();
    const command = checkoutCommand();
    await checkout.complete(context, branchId, command);
    await prisma.organizationMembership.update({
      where: { organizationId_userId: { organizationId, userId } },
      data: { role: 'CASHIER' },
    });
    await expect(checkout.complete(context, branchId, command)).rejects.toThrow(
      'Branch not found',
    );
    await prisma.branchMembership.create({
      data: { organizationId, branchId, userId },
    });
    await expect(
      checkout.complete(context, branchId, command),
    ).resolves.toMatchObject({ total: '25.00' });
    await prisma.organizationMembership.update({
      where: { organizationId_userId: { organizationId, userId } },
      data: { role: 'MERCHANT' },
    });
    await expect(checkout.complete(context, branchId, command)).rejects.toThrow(
      'cannot complete checkout',
    );
    await prisma.organizationMembership.delete({
      where: { organizationId_userId: { organizationId, userId } },
    });
    await expect(checkout.complete(context, branchId, command)).rejects.toThrow(
      'Organization not found',
    );
    const another = await prisma.user.create({
      data: {
        firstName: 'Other',
        lastName: 'Owner',
        email: `${randomUUID()}@example.test`,
        passwordHash: 'unused',
      },
    });
    await prisma.organizationMembership.create({
      data: { organizationId, userId: another.id, role: 'OWNER' },
    });
    await expect(
      checkout.complete({ ...context, userId: another.id }, branchId, command),
    ).rejects.toThrow('Request ID');
  });
  it.each([
    'price',
    'stock',
    'product',
    'merchant',
    'cash',
    'foreign-line',
    'foreign-branch',
    'duplicate',
  ] as const)('does not commit invalid checkout: %s', async (failure) => {
    const context = await checkoutSetup();
    const command = checkoutCommand();
    if (failure === 'price') command.items[0].expectedUnitPrice = '12.00';
    if (failure === 'stock') command.items[0].quantity = 6;
    if (failure === 'product')
      await prisma.product.update({
        where: { id: productId },
        data: { status: 'INACTIVE' },
      });
    if (failure === 'merchant')
      await prisma.merchant.update({
        where: { id: merchantId },
        data: { status: 'INACTIVE' },
      });
    if (failure === 'cash') command.cashTender = '24.99';
    if (failure === 'foreign-line')
      command.items[0].branchInventoryId = randomUUID();
    if (failure === 'duplicate') command.items.push(command.items[0]);
    await expect(
      checkout.complete(
        context,
        failure === 'foreign-branch' ? randomUUID() : branchId,
        command,
      ),
    ).rejects.toThrow();
    expect(await prisma.sale.count({ where: { organizationId } })).toBe(0);
    expect(
      (
        await prisma.branchInventory.findUniqueOrThrow({
          where: { id: inventoryId },
        })
      ).quantity,
    ).toBe(5);
  });
  it.each(['Sale', 'SaleItem', 'InventoryMovement'])(
    'rolls back all writes when %s insertion fails',
    async (table) => {
      const context = await checkoutSetup();
      await admin.query(
        `CREATE FUNCTION fail_checkout_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test checkout insertion failure'; END; $$`,
      );
      await admin.query(
        `CREATE TRIGGER fail_checkout_insert BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION fail_checkout_insert()`,
      );
      try {
        await expect(
          checkout.complete(context, branchId, checkoutCommand()),
        ).rejects.toThrow();
        expect(await prisma.sale.count({ where: { organizationId } })).toBe(0);
        expect(await prisma.saleItem.count({ where: { organizationId } })).toBe(
          0,
        );
        expect(
          await prisma.inventoryMovement.count({
            where: { organizationId, type: 'SALE' },
          }),
        ).toBe(0);
        expect(
          (
            await prisma.branchInventory.findUniqueOrThrow({
              where: { id: inventoryId },
            })
          ).quantity,
        ).toBe(5);
      } finally {
        await admin.query(`DROP TRIGGER fail_checkout_insert ON "${table}"`);
        await admin.query('DROP FUNCTION fail_checkout_insert()');
      }
    },
  );
  it('prevents overselling concurrent checkouts and reconciles the resulting ledger', async () => {
    const context = await checkoutSetup();
    const commands = [
      checkoutCommand({
        items: [
          {
            branchInventoryId: inventoryId,
            quantity: 4,
            expectedUnitPrice: '12.50',
          },
        ],
      }),
      checkoutCommand({
        items: [
          {
            branchInventoryId: inventoryId,
            quantity: 4,
            expectedUnitPrice: '12.50',
          },
        ],
      }),
    ];
    const results = await Promise.allSettled(
      commands.map((command) => checkout.complete(context, branchId, command)),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(await prisma.sale.count({ where: { organizationId } })).toBe(1);
    const balance = await prisma.branchInventory.findUniqueOrThrow({
      where: { id: inventoryId },
    });
    const ledger = await prisma.inventoryMovement.aggregate({
      where: { organizationId, branchInventoryId: inventoryId },
      _sum: { quantityChange: true },
    });
    expect(balance.quantity).toBe(1);
    expect(ledger._sum.quantityChange).toBe(balance.quantity);
  });
  it('resolves simultaneous identical requests as one sale and one deduction', async () => {
    const context = await checkoutSetup();
    const command = checkoutCommand();
    const results = await Promise.allSettled([
      checkout.complete(context, branchId, command),
      checkout.complete(context, branchId, command),
    ]);
    const original = await checkout.complete(context, branchId, command);
    for (const result of results) {
      if (result.status === 'fulfilled') expect(result.value).toEqual(original);
    }
    expect(await prisma.sale.count({ where: { organizationId } })).toBe(1);
    expect(
      (
        await prisma.branchInventory.findUniqueOrThrow({
          where: { id: inventoryId },
        })
      ).quantity,
    ).toBe(3);
  });
  it('keeps mixed-merchant lines atomic and canonicalizes reversed line order', async () => {
    const context = await checkoutSetup();
    const secondProduct = await prisma.product.create({
      data: {
        organizationId,
        merchantId: otherMerchantId,
        name: 'Other goods',
      },
    });
    const second = await prisma.branchInventory.create({
      data: {
        organizationId,
        branchId,
        productId: secondProduct.id,
        quantity: 2,
        sellingPrice: '0.01',
      },
    });
    const command = checkoutCommand({
      items: [
        {
          branchInventoryId: second.id,
          quantity: 2,
          expectedUnitPrice: '0.01',
        },
        ...checkoutCommand().items,
      ],
    });
    const result = await checkout.complete(context, branchId, command);
    expect(result.total).toBe('25.02');
    expect(result.items).toHaveLength(2);
    expect(
      await checkout.complete(context, branchId, {
        ...command,
        items: [...command.items].reverse(),
      }),
    ).toEqual(result);
    expect(
      await prisma.inventoryMovement.count({
        where: { organizationId, type: 'SALE' },
      }),
    ).toBe(2);
  });
  it('rejects a simultaneous conflicting request and prevents a cross-branch replay', async () => {
    const context = await checkoutSetup();
    const command = checkoutCommand();
    const results = await Promise.allSettled([
      checkout.complete(context, branchId, command),
      checkout.complete(context, branchId, { ...command, cashTender: '51.00' }),
    ]);
    const success = results.find((result) => result.status === 'fulfilled');
    expect(success?.status).toBe('fulfilled');
    if (!success || success.status !== 'fulfilled')
      throw new Error('Expected one checkout to commit');
    await expect(
      checkout.complete(context, branchId, {
        ...command,
        cashTender: success.value.cashTender === '50.00' ? '51.00' : '50.00',
      }),
    ).rejects.toThrow('Request ID');
    await expect(
      checkout.complete(context, otherBranchId, command),
    ).rejects.toThrow('Request ID');
    expect(await prisma.sale.count({ where: { organizationId } })).toBe(1);
    expect(
      (
        await prisma.branchInventory.findUniqueOrThrow({
          where: { id: inventoryId },
        })
      ).quantity,
    ).toBe(3);
  });
  it('allows separate manual checkouts to reuse the same entered payment reference', async () => {
    const context = await checkoutSetup();
    const payment = {
      paymentMethod: 'GCASH' as const,
      cashTender: undefined,
      paymentReference: 'same-manual-reference',
    };
    const first = await checkout.complete(
      context,
      branchId,
      checkoutCommand(payment),
    );
    const second = await checkout.complete(
      context,
      branchId,
      checkoutCommand(payment),
    );
    expect(first.id).not.toBe(second.id);
    expect(first.paymentReference).toBe(second.paymentReference);
    expect(await prisma.sale.count({ where: { organizationId } })).toBe(2);
  });
  it('rejects a failing second cart line without deducting the first', async () => {
    const context = await checkoutSetup();
    const product = await prisma.product.create({
      data: {
        organizationId,
        merchantId: otherMerchantId,
        name: 'Limited stock',
      },
    });
    const placement = await prisma.branchInventory.create({
      data: {
        organizationId,
        branchId,
        productId: product.id,
        sellingPrice: '1.00',
        quantity: 1,
      },
    });
    await expect(
      checkout.complete(
        context,
        branchId,
        checkoutCommand({
          items: [
            ...checkoutCommand().items,
            {
              branchInventoryId: placement.id,
              quantity: 2,
              expectedUnitPrice: '1.00',
            },
          ],
        }),
      ),
    ).rejects.toThrow('Insufficient stock');
    expect(await prisma.sale.count({ where: { organizationId } })).toBe(0);
    expect(
      (
        await prisma.branchInventory.findUniqueOrThrow({
          where: { id: inventoryId },
        })
      ).quantity,
    ).toBe(5);
  });
  it('competes safely with an existing inventory withdrawal', async () => {
    const context = await checkoutSetup();
    const stock = new InventoryStockService(prisma as unknown as PrismaService);
    const results = await Promise.allSettled([
      checkout.complete(
        context,
        branchId,
        checkoutCommand({
          items: [
            {
              branchInventoryId: inventoryId,
              quantity: 4,
              expectedUnitPrice: '12.50',
            },
          ],
        }),
      ),
      stock.adjust(organizationId, branchId, inventoryId, userId, {
        quantityChange: -4,
        reason: 'Concurrent correction',
        requestId: randomUUID(),
      }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const balance = await prisma.branchInventory.findUniqueOrThrow({
      where: { id: inventoryId },
    });
    const ledger = await prisma.inventoryMovement.aggregate({
      where: { organizationId, branchInventoryId: inventoryId },
      _sum: { quantityChange: true },
    });
    expect(balance.quantity).toBe(1);
    expect(ledger._sum.quantityChange).toBe(1);
  });
  it('derives an exact maximum-capacity 100-line total, tender and change', async () => {
    const context = await checkoutSetup();
    const ExactDecimal = Prisma.Decimal.clone({ precision: 40 });
    const quantity = 2147483647;
    const price = '9999999999.99';
    await prisma.branchInventory.update({
      where: { id: inventoryId },
      data: { quantity, sellingPrice: price },
    });
    await prisma.inventoryMovement.updateMany({
      where: { organizationId, branchInventoryId: inventoryId },
      data: { quantityChange: quantity, quantityAfter: quantity },
    });
    const extra = Array.from({ length: 99 }, (_, index) => ({
      id: randomUUID(),
      productId: randomUUID(),
      name: `Capacity ${index}`,
    }));
    await prisma.product.createMany({
      data: extra.map((row) => ({
        id: row.productId,
        organizationId,
        merchantId,
        name: row.name,
      })),
    });
    await prisma.branchInventory.createMany({
      data: extra.map((row) => ({
        id: row.id,
        organizationId,
        branchId,
        productId: row.productId,
        quantity,
        sellingPrice: price,
      })),
    });
    await prisma.inventoryMovement.createMany({
      data: extra.map((row) => ({
        organizationId,
        branchId,
        branchInventoryId: row.id,
        type: 'RECEIPT',
        quantityChange: quantity,
        quantityAfter: quantity,
        reason: 'Capacity opening stock',
        requestId: randomUUID(),
        createdById: userId,
      })),
    });
    const total = new ExactDecimal(price).times(quantity).times(100).toFixed(2);
    const result = await checkout.complete(
      context,
      branchId,
      checkoutCommand({
        cashTender: new ExactDecimal(total).plus('0.01').toFixed(2),
        items: [inventoryId, ...extra.map((row) => row.id)].map(
          (branchInventoryId) => ({
            branchInventoryId,
            quantity,
            expectedUnitPrice: price,
          }),
        ),
      }),
    );
    expect(result.total).toBe(total);
    expect(result.cashChange).toBe('0.01');
    const merchant = await salesMember('MERCHANT', merchantId);
    const own = await salesReads.findOne(merchant, branchId, result.id);
    expect(own).toHaveProperty('ownItemsSubtotal', total);
    expect(own).not.toHaveProperty('total');
    expect(own).not.toHaveProperty('paymentMethod');
    expect(result.items).toHaveLength(100);
    expect(
      await prisma.inventoryMovement.count({
        where: { organizationId, type: 'SALE' },
      }),
    ).toBe(100);
    expect(
      await prisma.branchInventory.count({
        where: { organizationId, quantity: { not: 0 } },
      }),
    ).toBe(0);
  }, 30000);
  it('reconciles checkout competing with stock receiving, including an explicit unchanged retry', async () => {
    const context = await checkoutSetup();
    const command = checkoutCommand();
    const stock = new InventoryStockService(prisma as unknown as PrismaService);
    const results = await Promise.allSettled([
      checkout.complete(context, branchId, command),
      stock.receive(organizationId, branchId, inventoryId, userId, {
        quantity: 3,
        reason: 'Concurrent delivery',
        requestId: randomUUID(),
      }),
    ]);
    expect(results[1].status).toBe('fulfilled');
    if (results[0].status === 'rejected')
      expect(results[0].reason).toBeInstanceOf(ConflictException);
    await checkout.complete(context, branchId, command);
    const balance = await prisma.branchInventory.findUniqueOrThrow({
      where: { id: inventoryId },
    });
    const ledger = await prisma.inventoryMovement.aggregate({
      where: { organizationId, branchInventoryId: inventoryId },
      _sum: { quantityChange: true },
    });
    expect(balance.quantity).toBe(6);
    expect(ledger._sum.quantityChange).toBe(6);
    expect(await prisma.sale.count({ where: { organizationId } })).toBe(1);
  });
  it('handles opposite multi-line cart ordering without partial deductions or overselling', async () => {
    const context = await checkoutSetup();
    const product = await prisma.product.create({
      data: {
        organizationId,
        merchantId: otherMerchantId,
        name: 'Second stock',
      },
    });
    const placement = await prisma.branchInventory.create({
      data: {
        organizationId,
        branchId,
        productId: product.id,
        sellingPrice: '1.00',
        quantity: 5,
      },
    });
    await prisma.inventoryMovement.create({
      data: {
        organizationId,
        branchId,
        branchInventoryId: placement.id,
        type: 'RECEIPT',
        quantityChange: 5,
        quantityAfter: 5,
        reason: 'Second opening stock',
        createdById: userId,
        requestId: randomUUID(),
      },
    });
    const items = [
      {
        branchInventoryId: inventoryId,
        quantity: 3,
        expectedUnitPrice: '12.50',
      },
      {
        branchInventoryId: placement.id,
        quantity: 3,
        expectedUnitPrice: '1.00',
      },
    ];
    const results = await Promise.allSettled([
      checkout.complete(context, branchId, checkoutCommand({ items })),
      checkout.complete(
        context,
        branchId,
        checkoutCommand({ items: [...items].reverse() }),
      ),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(await prisma.sale.count({ where: { organizationId } })).toBe(1);
    expect(await prisma.saleItem.count({ where: { organizationId } })).toBe(2);
    for (const id of [inventoryId, placement.id]) {
      expect(
        (await prisma.branchInventory.findUniqueOrThrow({ where: { id } }))
          .quantity,
      ).toBe(2);
      expect(
        (
          await prisma.inventoryMovement.aggregate({
            where: { organizationId, branchInventoryId: id },
            _sum: { quantityChange: true },
          })
        )._sum.quantityChange,
      ).toBe(2);
    }
  });
  it('rolls back a previously written cart line when the second SALE movement fails', async () => {
    const context = await checkoutSetup();
    const product = await prisma.product.create({
      data: {
        organizationId,
        merchantId: otherMerchantId,
        name: 'Rollback goods',
      },
    });
    const placement = await prisma.branchInventory.create({
      data: {
        organizationId,
        branchId,
        productId: product.id,
        sellingPrice: '1.00',
        quantity: 5,
      },
    });
    await admin.query(
      `CREATE FUNCTION fail_second_sale_movement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."type"::text = 'SALE' AND EXISTS (SELECT 1 FROM "InventoryMovement" WHERE "organizationId" = NEW."organizationId" AND "type"::text = 'SALE') THEN RAISE EXCEPTION 'second sale movement failure'; END IF; RETURN NEW; END; $$`,
    );
    await admin.query(
      'CREATE TRIGGER fail_second_sale_movement BEFORE INSERT ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION fail_second_sale_movement()',
    );
    try {
      await expect(
        checkout.complete(
          context,
          branchId,
          checkoutCommand({
            items: [
              ...checkoutCommand().items,
              {
                branchInventoryId: placement.id,
                quantity: 2,
                expectedUnitPrice: '1.00',
              },
            ],
          }),
        ),
      ).rejects.toThrow();
      expect(await prisma.sale.count({ where: { organizationId } })).toBe(0);
      expect(await prisma.saleItem.count({ where: { organizationId } })).toBe(
        0,
      );
      expect(
        await prisma.inventoryMovement.count({
          where: { organizationId, type: 'SALE' },
        }),
      ).toBe(0);
      expect(
        await prisma.branchInventory.count({
          where: { organizationId, quantity: 5 },
        }),
      ).toBe(2);
    } finally {
      await admin.query(
        'DROP TRIGGER fail_second_sale_movement ON "InventoryMovement"',
      );
      await admin.query('DROP FUNCTION fail_second_sale_movement()');
    }
  });
  it('rejects a price changed while checkout waits for its stock lock, then requires price review', async () => {
    const context = await checkoutSetup();
    const command = checkoutCommand();
    const pid = (
      await admin.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
    ).rows[0].pid;
    await admin.query('BEGIN');
    await admin.query(
      'SELECT id FROM "BranchInventory" WHERE id = $1 FOR UPDATE',
      [inventoryId],
    );
    const pending = checkout.complete(context, branchId, command).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    let committed = false;
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 200; attempt++) {
        blocked = (
          await admin.query<{ blocked: boolean }>(
            'SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))) AS blocked',
            [pid],
          )
        ).rows[0].blocked;
        if (blocked) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      await admin.query(
        'UPDATE "BranchInventory" SET "sellingPrice" = 99.00 WHERE id = $1',
        [inventoryId],
      );
      await admin.query('COMMIT');
      committed = true;
      const outcome = await pending;
      expect(outcome).toHaveProperty('error');
      if ('error' in outcome)
        expect(outcome.error).toBeInstanceOf(ConflictException);
      expect(await prisma.sale.count({ where: { organizationId } })).toBe(0);
      expect(
        (
          await prisma.branchInventory.findUniqueOrThrow({
            where: { id: inventoryId },
          })
        ).quantity,
      ).toBe(5);
      await expect(
        checkout.complete(context, branchId, command),
      ).rejects.toThrow('Branch price changed');
    } finally {
      if (!committed) await admin.query('ROLLBACK');
      await pending;
    }
  }, 10000);
  it.each(['Product', 'Merchant'])(
    'preserves a consistent snapshot across concurrent %s lifecycle changes',
    async (table) => {
      const context = await checkoutSetup();
      const command = checkoutCommand();
      const pid = (
        await admin.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
      ).rows[0].pid;
      await admin.query('BEGIN');
      await admin.query(
        'SELECT id FROM "BranchInventory" WHERE id = $1 FOR UPDATE',
        [inventoryId],
      );
      const pending = checkout.complete(context, branchId, command).then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
      let committed = false;
      try {
        let blocked = false;
        for (let attempt = 0; attempt < 200; attempt++) {
          blocked = (
            await admin.query<{ blocked: boolean }>(
              'SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))) AS blocked',
              [pid],
            )
          ).rows[0].blocked;
          if (blocked) break;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(blocked).toBe(true);
        await admin.query(
          `UPDATE "${table}" SET status = 'INACTIVE', name = 'Concurrent rename' WHERE id = $1`,
          [table === 'Product' ? productId : merchantId],
        );
        await admin.query('COMMIT');
        committed = true;
        const outcome = await pending;
        if ('error' in outcome)
          expect(outcome.error).toBeInstanceOf(ConflictException);
        else
          expect(outcome.value.items[0]).toMatchObject({
            productName: 'Original product',
            merchantName: 'Original merchant',
            unitPrice: '12.50',
            lineTotal: '25.00',
          });
        // A transaction serialized before the lifecycle change may succeed with
        // its old snapshots; otherwise it aborts. Every subsequent new checkout
        // observes INACTIVE and is denied, with no partial stock/history writes.
        await expect(
          checkout.complete(context, branchId, checkoutCommand()),
        ).rejects.toThrow('Checkout requires active');
        const expected = 'error' in outcome ? 0 : 1;
        expect(await prisma.sale.count({ where: { organizationId } })).toBe(
          expected,
        );
        expect(
          await prisma.inventoryMovement.count({
            where: { organizationId, type: 'SALE' },
          }),
        ).toBe(expected);
        expect(
          (
            await prisma.branchInventory.findUniqueOrThrow({
              where: { id: inventoryId },
            })
          ).quantity,
        ).toBe(5 - expected * 2);
      } finally {
        if (!committed) await admin.query('ROLLBACK');
        await pending;
      }
    },
    10000,
  );
  it('scopes POS catalog and exact ambiguity matches, with lifecycle and stock filtering', async () => {
    const service = new PosCatalogService(prisma as unknown as PrismaService);
    const owner = { organizationId, userId, role: 'OWNER' as const };
    const second = await prisma.product.create({
      data: {
        organizationId,
        merchantId: otherMerchantId,
        name: 'Second product',
        sku: 'SECOND',
        barcode: 'ORIGINAL',
      },
    });
    await prisma.branchInventory.create({
      data: {
        organizationId,
        branchId,
        productId: second.id,
        sellingPrice: '99.99',
        quantity: 0,
      },
    });
    const matches = await service.findByCode(owner, branchId, 'ORIGINAL');
    expect(matches).toHaveLength(2);
    expect(matches[0]).toEqual({
      branchInventoryId: inventoryId,
      productId,
      name: 'Original product',
      sku: 'ORIGINAL',
      barcode: '001Ab',
      merchantName: 'Original merchant',
      sellingPrice: '12.50',
      quantity: 5,
      eligible: true,
    });
    expect(matches[1].eligible).toBe(false);
    await prisma.organizationMembership.create({
      data: { organizationId, userId, role: 'CASHIER' },
    });
    await prisma.branchMembership.create({
      data: { organizationId, userId, branchId },
    });
    expect(
      await service.findAll({ ...owner, role: 'CASHIER' }, branchId),
    ).toEqual(matches);
    expect(
      await service.findAll({ ...owner, role: 'MANAGER' }, branchId),
    ).toEqual(matches);
    await expect(
      service.findAll({ ...owner, role: 'CASHIER' }, otherBranchId),
    ).rejects.toThrow('Branch not found');
    await expect(
      service.findAll({ ...owner, organizationId: randomUUID() }, branchId),
    ).rejects.toThrow('Branch not found');
    await prisma.branchMembership.deleteMany({
      where: { organizationId, userId },
    });
    expect(await service.findByCode(owner, branchId, 'original')).toHaveLength(
      1,
    );
    expect(await service.findByCode(owner, branchId, '001Ab')).toHaveLength(1);
    expect(await service.findByCode(owner, branchId, '001ab')).toEqual([]);
    expect(await service.findByCode(owner, branchId, '01Ab')).toEqual([]);
    expect(await service.findByCode(owner, otherBranchId, 'ORIGINAL')).toEqual(
      [],
    );
    expect(await service.findAll(owner, branchId, 'original')).toHaveLength(1);
    await prisma.product.update({
      where: { id: second.id },
      data: { barcode: 'OTHER' },
    });
    await prisma.product.update({
      where: { id: productId },
      data: { barcode: 'ORIGINAL' },
    });
    expect(await service.findByCode(owner, branchId, 'ORIGINAL')).toHaveLength(
      1,
    );
    await prisma.product.update({
      where: { id: productId },
      data: { status: 'INACTIVE' },
    });
    expect(await service.findByCode(owner, branchId, 'ORIGINAL')).toHaveLength(
      0,
    );
    await prisma.merchant.update({
      where: { id: otherMerchantId },
      data: { status: 'ENDED' },
    });
    expect(await service.findAll(owner, branchId)).toEqual([]);
    await expect(
      service.findAll({ ...owner, role: 'CASHIER' }, branchId),
    ).rejects.toThrow('Branch not found');
    await expect(
      service.findAll({ ...owner, role: 'MERCHANT', merchantId }, branchId),
    ).rejects.toThrow('cannot access POS');
    await expect(service.findAll(owner, randomUUID())).rejects.toThrow(
      'Branch not found',
    );
  });
  beforeAll(async () => {
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    const migrations = join(__dirname, '../prisma/migrations');
    for (const directory of readdirSync(migrations)
      .filter((name) => /^\d/.test(name))
      .sort()) {
      await admin.query(
        readFileSync(
          join(migrations, directory, 'migration.sql'),
          'utf8',
        ).replace('CREATE SCHEMA IF NOT EXISTS "public";', ''),
      );
    }
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  });
  beforeEach(async () => {
    organizationId = (
      await prisma.organization.create({ data: { name: randomUUID() } })
    ).id;
    userId = (
      await prisma.user.create({
        data: {
          firstName: 'Original',
          lastName: 'actor',
          email: `${randomUUID()}@example.test`,
          passwordHash: 'unused',
        },
      })
    ).id;
    const branch = {
      organizationId,
      addressLine1: 'Test',
      city: 'Makati',
      province: 'Metro Manila',
      countryCode: 'PH',
    };
    branchId = (
      await prisma.branch.create({
        data: { ...branch, name: 'Original branch', code: 'ONE' },
      })
    ).id;
    otherBranchId = (
      await prisma.branch.create({ data: { ...branch, name: 'Second' } })
    ).id;
    const merchant = {
      organizationId,
      contactName: 'Test',
      phone: '09171234567',
    };
    merchantId = (
      await prisma.merchant.create({
        data: { ...merchant, name: 'Original merchant' },
      })
    ).id;
    otherMerchantId = (
      await prisma.merchant.create({
        data: { ...merchant, name: 'Other merchant' },
      })
    ).id;
    productId = (
      await prisma.product.create({
        data: {
          organizationId,
          merchantId,
          name: 'Original product',
          sku: 'ORIGINAL',
          barcode: '001Ab',
        },
      })
    ).id;
    inventoryId = (
      await prisma.branchInventory.create({
        data: {
          organizationId,
          branchId,
          productId,
          sellingPrice: '12.50',
          quantity: 5,
        },
      })
    ).id;
    await prisma.inventoryMovement.create({
      data: {
        organizationId,
        branchId,
        branchInventoryId: inventoryId,
        type: 'RECEIPT',
        quantityChange: 5,
        quantityAfter: 5,
        reason: 'Initial stock',
        createdById: userId,
        requestId: randomUUID(),
      },
    });
  });

  it.each(['CASH', 'GCASH', 'CARD'] as const)(
    'persists valid %s payments with exact decimal values',
    async (paymentMethod) => {
      const sale = await prisma.sale.create({
        data: saleData(
          paymentMethod === 'CASH'
            ? {}
            : {
                paymentMethod,
                cashTender: null,
                cashChange: null,
                paymentReference: 'TEST-REFERENCE',
              },
        ),
      });
      const item = await prisma.saleItem.create({ data: itemData(sale.id) });
      expect(sale.total.toFixed(2)).toBe('25.00');
      expect(item.lineTotal.toFixed(2)).toBe('25.00');
      expect(sale.paymentMethod).toBe(paymentMethod);
    },
  );
  it.each([
    { total: '0' },
    { total: '-1' },
    { total: 'NaN' },
    { cashTender: '24.99' },
    { cashTender: null },
    { cashChange: null },
    { cashChange: '4.99' },
    { cashTender: 'NaN' },
    { paymentReference: 'NOT-ALLOWED' },
    { checkoutCommand: [] },
    { receiptCode: ' ' },
    {
      paymentMethod: 'GCASH' as const,
      cashTender: null,
      cashChange: null,
      paymentReference: null,
    },
    {
      paymentMethod: 'CARD' as const,
      cashTender: null,
      cashChange: null,
      paymentReference: 'x',
    },
    {
      paymentMethod: 'CARD' as const,
      cashTender: null,
      cashChange: null,
      paymentReference: 'x'.repeat(101),
    },
    {
      paymentMethod: 'GCASH' as const,
      cashTender: null,
      cashChange: null,
      paymentReference: ' REF ',
    },
    { paymentMethod: 'GCASH' as const, paymentReference: 'REF' },
  ])('rejects invalid payment/amount/command fields %j', async (extra) => {
    await expect(
      prisma.sale.create({ data: saleData(extra) }),
    ).rejects.toThrow();
  });
  it.each([
    { quantity: 0 },
    { quantity: -1 },
    { unitPrice: '0' },
    { unitPrice: 'NaN' },
    { lineTotal: '24.99' },
  ])('rejects invalid item amounts %j', async (extra) => {
    const sale = await prisma.sale.create({ data: saleData() });
    await expect(
      prisma.saleItem.create({ data: itemData(sale.id, extra) }),
    ).rejects.toThrow();
  });
  it('supports maximum approved unit/quantity capacity and a 100-line total capacity', async () => {
    const ExactDecimal = Prisma.Decimal.clone({ precision: 40 });
    const lineTotal = new ExactDecimal('9999999999.99').times(2147483647);
    const total = lineTotal.times(100);
    const sale = await prisma.sale.create({
      data: saleData({
        total,
        cashTender: total.plus('0.01'),
        cashChange: '0.01',
      }),
    });
    const item = await prisma.saleItem.create({
      data: itemData(sale.id, {
        unitPrice: '9999999999.99',
        quantity: 2147483647,
        lineTotal,
      }),
    });
    expect(sale.total.toFixed(2)).toBe(total.toFixed(2));
    expect(item.lineTotal.toFixed(2)).toBe(lineTotal.toFixed(2));
  });
  it('enforces receipt/request and sale-placement uniqueness while allowing reused manual references', async () => {
    const sale = await prisma.sale.create({ data: saleData() });
    await expect(
      prisma.sale.create({ data: saleData({ receiptCode: sale.receiptCode }) }),
    ).rejects.toThrow();
    await expect(
      prisma.sale.create({ data: saleData({ requestId: sale.requestId }) }),
    ).rejects.toThrow();
    await prisma.saleItem.create({ data: itemData(sale.id) });
    await expect(
      prisma.saleItem.create({ data: itemData(sale.id) }),
    ).rejects.toThrow();
    for (let i = 0; i < 2; i++)
      await prisma.sale.create({
        data: saleData({
          paymentMethod: 'GCASH',
          cashTender: null,
          cashChange: null,
          paymentReference: 'REUSED-REF',
        }),
      });
  });
  it('rejects foreign-tenant branches and mismatched item branch/product/merchant relationships', async () => {
    const foreignOrg = await prisma.organization.create({
      data: { name: 'Foreign' },
    });
    const foreignBranch = await prisma.branch.create({
      data: {
        organizationId: foreignOrg.id,
        name: 'Foreign',
        addressLine1: 'Test',
        city: 'Test',
        province: 'Test',
        countryCode: 'PH',
      },
    });
    await expect(
      prisma.sale.create({ data: saleData({ branchId: foreignBranch.id }) }),
    ).rejects.toThrow();
    const sale = await prisma.sale.create({ data: saleData() });
    const otherProduct = await prisma.product.create({
      data: { organizationId, merchantId, name: 'Different' },
    });
    const foreignMerchant = await prisma.merchant.create({
      data: {
        organizationId: foreignOrg.id,
        name: 'Foreign',
        contactName: 'Test',
        phone: '09171234567',
      },
    });
    for (const extra of [
      { branchId: otherBranchId },
      { organizationId: foreignOrg.id },
      { productId: otherProduct.id },
      { merchantId: otherMerchantId },
      { merchantId: foreignMerchant.id },
    ]) {
      await expect(
        prisma.saleItem.create({ data: itemData(sale.id, extra) }),
      ).rejects.toThrow();
    }
  });
  it('enforces negative SALE linkage, exactly one movement per item and matching placement/branch', async () => {
    const sale = await prisma.sale.create({ data: saleData() });
    const item = await prisma.saleItem.create({ data: itemData(sale.id) });
    for (const extra of [
      { saleItemId: null },
      { quantityChange: 2 },
      { type: 'ADJUSTMENT' as const },
      { type: 'RECEIPT' as const, quantityChange: 2 },
      { saleItemId: randomUUID() },
      { branchId: otherBranchId },
    ]) {
      await expect(
        prisma.inventoryMovement.create({ data: movementData(item.id, extra) }),
      ).rejects.toThrow();
    }
    const secondPlacement = await prisma.branchInventory.create({
      data: {
        organizationId,
        branchId: otherBranchId,
        productId,
        sellingPrice: '15.00',
      },
    });
    await expect(
      prisma.inventoryMovement.create({
        data: movementData(item.id, {
          branchId: otherBranchId,
          branchInventoryId: secondPlacement.id,
        }),
      }),
    ).rejects.toThrow();
    await prisma.inventoryMovement.create({ data: movementData(item.id) });
    await expect(
      prisma.inventoryMovement.create({ data: movementData(item.id) }),
    ).rejects.toThrow();
  });
  it('rolls back sale/items/deduction when linked movement insertion fails', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const sale = await tx.sale.create({ data: saleData() });
        const item = await tx.saleItem.create({ data: itemData(sale.id) });
        await tx.branchInventory.update({
          where: { id: inventoryId },
          data: { quantity: { decrement: 2 } },
        });
        await tx.inventoryMovement.create({
          data: movementData(item.id, { quantityChange: 2 }),
        });
      }),
    ).rejects.toThrow();
    expect(await prisma.sale.count({ where: { organizationId } })).toBe(0);
    expect(await prisma.saleItem.count({ where: { organizationId } })).toBe(0);
    expect(
      (
        await prisma.branchInventory.findUniqueOrThrow({
          where: { id: inventoryId },
        })
      ).quantity,
    ).toBe(5);
  });
  it('preserves snapshots/history after identity changes and membership removal', async () => {
    const sale = await prisma.sale.create({ data: saleData() });
    const item = await prisma.saleItem.create({ data: itemData(sale.id) });
    await prisma.inventoryMovement.create({ data: movementData(item.id) });
    await prisma.organizationMembership.create({
      data: { organizationId, userId, role: 'CASHIER' },
    });
    await prisma.organizationMembership.delete({
      where: { organizationId_userId: { organizationId, userId } },
    });
    await prisma.product.update({
      where: { id: productId },
      data: {
        name: 'Changed product',
        sku: 'CHANGED',
        barcode: 'New',
        status: 'INACTIVE',
      },
    });
    await prisma.merchant.update({
      where: { id: merchantId },
      data: { name: 'Changed merchant', status: 'ENDED' },
    });
    await prisma.branch.update({
      where: { id: branchId },
      data: { name: 'Changed branch' },
    });
    await prisma.organization.update({
      where: { id: organizationId },
      data: { name: 'Changed store' },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { firstName: 'Changed', deletedAt: new Date() },
    });
    expect(
      await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } }),
    ).toMatchObject({
      organizationName: 'Original store',
      branchName: 'Original branch',
      cashierName: 'Original actor',
    });
    expect(
      await prisma.saleItem.findUniqueOrThrow({ where: { id: item.id } }),
    ).toMatchObject({
      productName: 'Original product',
      merchantName: 'Original merchant',
      sku: 'ORIGINAL',
      barcode: '001Ab',
    });
    for (const deletion of [
      () => prisma.sale.delete({ where: { id: sale.id } }),
      () => prisma.saleItem.delete({ where: { id: item.id } }),
      () => prisma.branchInventory.delete({ where: { id: inventoryId } }),
      () => prisma.product.delete({ where: { id: productId } }),
      () => prisma.merchant.delete({ where: { id: merchantId } }),
      () => prisma.branch.delete({ where: { id: branchId } }),
      () => prisma.user.delete({ where: { id: userId } }),
    ])
      await expect(deletion()).rejects.toThrow();
  });
  it('keeps internal sale links out of existing owner and merchant history contracts', async () => {
    const sale = await prisma.sale.create({ data: saleData() });
    const item = await prisma.saleItem.create({ data: itemData(sale.id) });
    await prisma.inventoryMovement.create({ data: movementData(item.id) });
    const inventory = new BranchInventoryService(
      prisma as unknown as PrismaService,
    );
    const ownerHistory = await inventory.findMovements(
      organizationId,
      branchId,
      inventoryId,
    );
    const merchantHistory = await inventory.findMovements(
      organizationId,
      branchId,
      inventoryId,
      { organizationId, userId, role: 'MERCHANT', merchantId },
    );
    expect(ownerHistory.some((entry) => entry.type === 'SALE')).toBe(true);
    for (const entry of ownerHistory)
      expect(entry).not.toHaveProperty('saleItemId');
    for (const entry of merchantHistory) {
      expect(entry).not.toHaveProperty('saleItemId');
      expect(entry).not.toHaveProperty('createdById');
    }
  });
});
