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
  branchAccessCount: z.number().int().nonnegative(),
  joinedAt: z.iso.datetime({ offset: true }),
  merchantId: z.uuidv4().nullable(),
});
export const memberPageSchema = z.object({
  items: memberResponseSchema.array(),
  page: z.number().int().positive(),
  limit: z.literal(15),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
});
export const memberAccessEventSchema = z.object({
  id: z.uuidv4(),
  occurredAt: z.iso.datetime({ offset: true }),
  operation: z.enum([
    'ROLE_CHANGED',
    'MERCHANT_LINKED',
    'MERCHANT_UNLINKED',
    'BRANCH_GRANTED',
    'BRANCH_REVOKED',
    'MEMBER_REMOVED',
  ]),
  actorId: z.uuidv4(),
  actorName: z.string(),
  targetUserId: z.uuidv4(),
  targetName: z.string(),
  beforeState: z.record(z.string(), z.unknown()),
  afterState: z.record(z.string(), z.unknown()),
});
export const memberAccessEventPageSchema = z.object({
  items: memberAccessEventSchema.array(),
  page: z.number().int().positive(),
  limit: z.literal(15),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
});
export type AccessBranch = z.infer<typeof accessBranchSchema>;
export type AccessMerchant = z.infer<typeof accessMerchantSchema>;
