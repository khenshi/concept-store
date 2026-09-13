import {
  BadRequestException,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ResourceAccessGuard } from './resource-access.guard';

describe('ResourceAccessGuard', () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const prisma = {
    branch: { findFirst: jest.fn() },
    product: { findFirst: jest.fn() },
    merchant: { findFirst: jest.fn() },
    branchInventory: { findFirst: jest.fn() },
  };
  const guard = new ResourceAccessGuard(prisma as unknown as PrismaService);
  const run = (
    params: object,
    role = 'MANAGER',
    query = {},
    method = 'GET',
    body = {},
  ) =>
    guard.canActivate({
      switchToHttp: () => ({
        getRequest: () => ({
          params,
          query,
          method,
          body,
          organizationContext: {
            organizationId: id,
            userId: id,
            role,
            merchantId: id,
          },
        }),
      }),
    } as unknown as ExecutionContext);
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('hides unassigned branches before reading inventory', async () => {
    await expect(run({ branchId: id, inventoryId: id })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.branchInventory.findFirst).not.toHaveBeenCalled();
    expect(prisma.branch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              organizationId: id,
              memberships: { some: { organizationId: id, userId: id } },
            },
            { id },
          ],
        },
      }),
    );
  });
  it('hides foreign/unrepresented products, merchant filters, and placement candidates', async () => {
    await expect(run({ productId: id })).rejects.toThrow(NotFoundException);
    await expect(run({}, 'MANAGER', { merchantId: id })).rejects.toThrow(
      NotFoundException,
    );
    prisma.branch.findFirst.mockResolvedValue({ id });
    await expect(
      run({ branchId: id }, 'MANAGER', {}, 'POST', { productId: id }),
    ).rejects.toThrow(NotFoundException);
  });
  it('checks merchant ownership and branch scope on inventory details', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id });
    await expect(
      run({ branchId: id, inventoryId: id }, 'MERCHANT'),
    ).rejects.toThrow(NotFoundException);
    expect(
      JSON.stringify(prisma.branchInventory.findFirst.mock.calls),
    ).toContain(JSON.stringify({ organizationId: id, merchantId: id }));
  });
  it('validates guessed IDs while keeping owner checks in tenant-scoped services', async () => {
    await expect(run({ branchId: 'bad' })).rejects.toThrow(BadRequestException);
    await expect(run({ branchId: id }, 'OWNER')).resolves.toBe(true);
  });
});
