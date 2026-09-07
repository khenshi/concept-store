import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrganizationRole, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RefundsService } from './refunds.service';

describe('RefundsService', () => {
  const tx = {
    organizationMembership: { findUnique: jest.fn() },
    sale: { findFirst: jest.fn() },
    saleRefundItem: { groupBy: jest.fn() },
    saleRefund: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
    inventory: { updateMany: jest.fn() },
    inventoryMovement: { createMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(
      (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
    ),
  };
  let service: RefundsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    tx.organizationMembership.findUnique.mockResolvedValue({
      role: OrganizationRole.OWNER,
    });
    tx.sale.findFirst.mockResolvedValue({
      id: 'sale',
      items: [
        {
          id: 'item',
          productId: 'product',
          merchantId: 'merchant',
          quantity: 4,
          total: new Prisma.Decimal('1000.00'),
        },
      ],
    });
    tx.saleRefundItem.groupBy.mockResolvedValue([
      { saleItemId: 'item', _sum: { quantity: 1 } },
    ]);
    tx.saleRefund.create.mockResolvedValue({ id: 'refund', items: [] });
    tx.inventory.updateMany.mockResolvedValue({ count: 1 });
    tx.inventoryMovement.createMany.mockResolvedValue({ count: 1 });
    tx.saleRefund.findUniqueOrThrow.mockResolvedValue({
      id: 'refund',
      items: [],
    });
    const module = await Test.createTestingModule({
      providers: [RefundsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(RefundsService);
  });

  it('derives a proportional refund amount from the original sale item', async () => {
    await service.create('organization', 'branch', 'sale', 'owner', {
      reason: 'Returned',
      items: [{ saleItemId: 'item', quantity: 2 }],
    });
    expect(tx.saleRefund.create).toHaveBeenCalledWith({
      // Jest asymmetric matchers are intentionally untyped at this boundary.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        organizationId: 'organization',
        branchId: 'branch',
        saleId: 'sale',
        completedById: 'owner',
        items: {
          create: [
            expect.objectContaining({
              saleItemId: 'item',
              quantity: 2,
              amount: new Prisma.Decimal('500.00'),
            }),
          ],
        },
      }),
    });
    expect(tx.inventory.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'organization',
        branchId: 'branch',
        productId: 'product',
      },
      data: { quantity: { increment: 2 } },
    });
  });

  it('rejects over-refunds and stale roles', async () => {
    await expect(
      service.create('organization', 'branch', 'sale', 'owner', {
        reason: 'Returned',
        items: [{ saleItemId: 'item', quantity: 4 }],
      }),
    ).rejects.toThrow(ConflictException);
    tx.organizationMembership.findUnique.mockResolvedValue({
      role: OrganizationRole.CASHIER,
    });
    await expect(
      service.create('organization', 'branch', 'sale', 'cashier', {
        reason: 'Returned',
        items: [{ saleItemId: 'item', quantity: 1 }],
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
