import type { Prisma } from '../../../generated/prisma/client';

export const spaceAssignmentInclude = {
  merchant: {
    select: { id: true, name: true, code: true },
  },
} satisfies Prisma.SpaceAssignmentInclude;

export type SpaceAssignmentRecord = Prisma.SpaceAssignmentGetPayload<{
  include: typeof spaceAssignmentInclude;
}>;
