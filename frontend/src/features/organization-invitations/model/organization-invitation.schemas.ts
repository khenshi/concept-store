import { z } from 'zod';
import {
  accessBranchSchema,
  accessMerchantSchema,
} from '@/features/organization-members/model/member-access.schemas';

export const invitationResponseSchema = z.object({
  id: z.uuidv4(),
  organizationId: z.uuidv4(),
  email: z.email(),
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER', 'MERCHANT']),
  expiresAt: z.iso.datetime({ offset: true }),
  createdAt: z.iso.datetime({ offset: true }),
  acceptedAt: z.iso.datetime({ offset: true }).nullable(),
  revokedAt: z.iso.datetime({ offset: true }).nullable(),
  merchantId: z.uuidv4().nullable(),
  merchant: accessMerchantSchema.nullable(),
  branches: z.array(z.object({ branch: accessBranchSchema })),
});
export const createdInvitationResponseSchema = z.object({
  invitation: invitationResponseSchema,
  token: z.string().min(1),
});

export const createOrganizationInvitationSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Enter a valid email address.')
      .max(254, 'Email must be 254 characters or fewer.'),
    role: z.enum(['MANAGER', 'CASHIER', 'MERCHANT']),
    branchIds: z
      .array(z.uuidv4())
      .max(100, 'Select at most 100 branches.')
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Select each branch once.',
      )
      .optional(),
    merchantId: z.uuidv4('Choose a merchant profile.').optional(),
  })
  .superRefine((value, context) => {
    if (value.role === 'MERCHANT' && !value.merchantId)
      context.addIssue({
        code: 'custom',
        path: ['merchantId'],
        message: 'Choose a merchant profile.',
      });
    if (value.role !== 'MERCHANT' && value.merchantId !== undefined)
      context.addIssue({
        code: 'custom',
        path: ['merchantId'],
        message: 'Merchant profiles apply only to merchant invitations.',
      });
  });
