import { ConflictException, NotFoundException } from '@nestjs/common';
import { BranchStatus, Prisma } from '../../generated/prisma/client';

export type LockedBranch = {
  id: string;
  status: BranchStatus;
  updatedAt: Date;
};

export async function lockBranch(
  tx: Prisma.TransactionClient,
  organizationId: string,
  branchId: string,
): Promise<LockedBranch> {
  const rows = await tx.$queryRaw<LockedBranch[]>(
    Prisma.sql`SELECT "id", "status", "updatedAt" FROM "Branch" WHERE "organizationId" = ${organizationId} AND "id" = ${branchId} FOR UPDATE`,
  );
  const locked = rows.find((row) => row.id === branchId);
  if (locked) return locked;

  // Unit doubles do not implement row-locking SQL; the fallback also preserves
  // the normal not-found contract when the raw query returns no rows.
  const branch = await tx.branch.findUnique({
    where: { id_organizationId: { id: branchId, organizationId } },
    select: { id: true, status: true, updatedAt: true },
  });
  if (!branch) throw new NotFoundException('Branch not found');
  return branch;
}

export async function assertBranchWriteAllowed(
  tx: Prisma.TransactionClient,
  organizationId: string,
  branchId: string,
  options: { allowInactive?: boolean } = {},
): Promise<LockedBranch> {
  const branch = await lockBranch(tx, organizationId, branchId);
  if (!options.allowInactive && branch.status === BranchStatus.INACTIVE) {
    throw new ConflictException({
      message: 'Branch is inactive and does not accept new operations',
      code: 'BRANCH_INACTIVE',
    });
  }
  return branch;
}

export async function lockBranches(
  tx: Prisma.TransactionClient,
  organizationId: string,
  branchIds: string[],
): Promise<Map<string, LockedBranch>> {
  const result = new Map<string, LockedBranch>();
  for (const branchId of [...new Set(branchIds)].sort()) {
    result.set(branchId, await lockBranch(tx, organizationId, branchId));
  }
  return result;
}

export function assertBranchesActive(
  branches: Map<string, LockedBranch>,
  branchIds: string[],
) {
  for (const branchId of [...new Set(branchIds)].sort()) {
    const branch = branches.get(branchId);
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.status === BranchStatus.INACTIVE) {
      throw new ConflictException({
        message: 'Branch is inactive and does not accept new operations',
        code: 'BRANCH_INACTIVE',
      });
    }
  }
}
