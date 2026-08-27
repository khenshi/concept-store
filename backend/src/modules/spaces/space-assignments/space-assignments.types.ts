import type { Prisma } from '../../../generated/prisma/client';

export const spaceAssignmentInclude = {
  merchant: {
    select: { id: true, name: true, code: true },
  },
} satisfies Prisma.SpaceAssignmentInclude;

export const branchSpaceAssignmentInclude = {
  ...spaceAssignmentInclude,
  space: {
    select: { id: true, code: true, name: true, type: true, status: true },
  },
} satisfies Prisma.SpaceAssignmentInclude;

export type SpaceAssignmentRecord = Prisma.SpaceAssignmentGetPayload<{
  include: typeof spaceAssignmentInclude;
}>;

export type BranchSpaceAssignmentRecord = Prisma.SpaceAssignmentGetPayload<{
  include: typeof branchSpaceAssignmentInclude;
}>;
