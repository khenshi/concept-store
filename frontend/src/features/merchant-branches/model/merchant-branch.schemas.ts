import { z } from 'zod';
import { merchantStatusSchema } from '@/features/merchants/model/merchant.schemas';
export const participationStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
const identity = z.object({
  id: z.uuidv4(),
  name: z.string(),
  code: z.string().nullable(),
});
export const merchantBranchSchema = z
  .object({
    id: z.uuidv4(),
    organizationId: z.uuidv4(),
    merchantId: z.uuidv4(),
    branchId: z.uuidv4(),
    status: participationStatusSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    branch: identity,
    merchant: identity.extend({ status: merchantStatusSchema }),
  })
  .refine(
    (row) =>
      row.branch.id === row.branchId && row.merchant.id === row.merchantId,
    'Association identity mismatch',
  );
export const merchantBranchPageSchema = z
  .object({
    items: z.array(merchantBranchSchema).max(15),
    page: z.number().int().min(1),
    limit: z.literal(15),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
    hasNext: z.boolean(),
  })
  .refine(
    (page) =>
      page.totalPages === Math.ceil(page.total / 15) &&
      page.hasNext === page.page * 15 < page.total &&
      new Set(page.items.map((row) => row.id)).size === page.items.length,
    'Invalid association pagination',
  );
export type MerchantBranch = z.infer<typeof merchantBranchSchema>;
export type MerchantBranchPage = z.infer<typeof merchantBranchPageSchema>;
