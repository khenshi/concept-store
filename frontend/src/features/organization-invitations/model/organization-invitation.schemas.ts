import { z } from 'zod';

export const createOrganizationInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address.')
    .max(254, 'Email must be 254 characters or fewer.'),
  role: z.enum(['MANAGER', 'CASHIER', 'MERCHANT']),
});
