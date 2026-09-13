import { z } from 'zod';

export const accessBranchSchema = z.object({
  id: z.uuidv4(),
  name: z.string().min(1),
  code: z.string().nullable(),
});
export const accessMerchantSchema = accessBranchSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'ENDED']),
});
export const memberResponseSchema = z.object({
  id: z.uuidv4(),
  email: z.email(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER', 'MERCHANT']),
  joinedAt: z.iso.datetime({ offset: true }),
  merchantId: z.uuidv4().nullable(),
});
export type AccessBranch = z.infer<typeof accessBranchSchema>;
export type AccessMerchant = z.infer<typeof accessMerchantSchema>;
