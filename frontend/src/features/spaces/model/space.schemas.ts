import { z } from 'zod';
const identity = z.object({
  id: z.uuidv4(),
  name: z.string(),
  code: z.string().nullable(),
});
const actorIdentity = z.object({ id: z.uuidv4(), name: z.string() });
export const spaceStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);
export const releaseReasonSchema = z.enum([
  'MANUAL',
  'PARTICIPATION_INACTIVE',
  'MERCHANT_INACTIVE',
  'MERCHANT_SUSPENDED',
  'MERCHANT_ENDED',
]);
export const occupancySchema = z
  .object({
    id: z.uuidv4(),
    organizationId: z.uuidv4(),
    branchId: z.uuidv4(),
    spaceId: z.uuidv4(),
    merchantId: z.uuidv4(),
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime().nullable(),
    releaseReason: releaseReasonSchema.nullable(),
    releasedBy: actorIdentity.nullable(),
    space: z.object({
      id: z.uuidv4(),
      name: z.string(),
      type: z.string(),
      status: spaceStatusSchema,
    }),
    branch: identity,
    merchant: identity,
  })
  .refine(
    (row) =>
      row.space.id === row.spaceId &&
      row.branch.id === row.branchId &&
      row.merchant.id === row.merchantId &&
      (row.endedAt === null
        ? row.releaseReason === null
        : row.releaseReason !== null &&
          Date.parse(row.endedAt) > Date.parse(row.startedAt)),
    'Occupancy identity or dates mismatch',
  );
export const spaceSchema = z.object({
  id: z.uuidv4(),
  organizationId: z.uuidv4(),
  branchId: z.uuidv4(),
  name: z.string(),
  type: z.string(),
  status: spaceStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const spaceListItemSchema = spaceSchema
  .extend({ currentOccupancy: occupancySchema.nullable() })
  .refine(
    (row) =>
      row.currentOccupancy === null ||
      (row.currentOccupancy.spaceId === row.id &&
        row.currentOccupancy.organizationId === row.organizationId &&
        row.currentOccupancy.branchId === row.branchId &&
        row.currentOccupancy.endedAt === null),
    'Current occupancy scope mismatch',
  );
const pageShape = {
  page: z.number().int().min(1),
  limit: z.literal(15),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasNext: z.boolean(),
};
function validPage(page: {
  total: number;
  totalPages: number;
  page: number;
  hasNext: boolean;
  items: { id: string }[];
}) {
  return (
    page.totalPages === Math.ceil(page.total / 15) &&
    page.hasNext === page.page * 15 < page.total &&
    new Set(page.items.map((row) => row.id)).size === page.items.length
  );
}
export const spacePageSchema = z
  .object({ ...pageShape, items: z.array(spaceListItemSchema).max(15) })
  .refine(validPage, 'Invalid space pagination');
export const occupancyPageSchema = z
  .object({ ...pageShape, items: z.array(occupancySchema).max(15) })
  .refine(validPage, 'Invalid occupancy pagination');
export const spaceFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter a space name.').max(120),
  type: z.string().trim().min(1, 'Enter a space type.').max(80),
});
export function occupancyDates(start: string, end: string, now = Date.now()) {
  const convert = (value: string) => {
    if (!value) return undefined;
    const date = new Date(
      /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value,
    );
    if (!Number.isFinite(date.getTime()))
      throw new Error('Enter a valid date.');
    return date.toISOString();
  };
  const startedAt = convert(start);
  const endedAt = convert(end);
  if (
    (startedAt && Date.parse(startedAt) > now) ||
    (endedAt && Date.parse(endedAt) > now)
  )
    throw new Error('Dates must be in the past or present.');
  if (
    endedAt &&
    Date.parse(endedAt) <= (startedAt ? Date.parse(startedAt) : now)
  )
    throw new Error(
      'End must be after start. Enter a start when recording past occupancy.',
    );
  return {
    ...(startedAt ? { startedAt } : {}),
    ...(endedAt ? { endedAt } : {}),
  };
}
export type Space = z.infer<typeof spaceSchema>;
export type SpaceListItem = z.infer<typeof spaceListItemSchema>;
export type Occupancy = z.infer<typeof occupancySchema>;
export type SpacePage = z.infer<typeof spacePageSchema>;
export type OccupancyPage = z.infer<typeof occupancyPageSchema>;
export const releaseLabels: Record<
  z.infer<typeof releaseReasonSchema>,
  string
> = {
  MANUAL: 'Released by owner',
  PARTICIPATION_INACTIVE: 'Branch participation deactivated',
  MERCHANT_INACTIVE: 'Merchant marked inactive',
  MERCHANT_SUSPENDED: 'Merchant suspended',
  MERCHANT_ENDED: 'Merchant ended',
};

export const spaceTypeSchema = z.object({
  id: z.uuidv4(),
  organizationId: z.uuidv4(),
  name: z.string().trim().min(1).max(80),
});
export type SpaceType = z.infer<typeof spaceTypeSchema>;
