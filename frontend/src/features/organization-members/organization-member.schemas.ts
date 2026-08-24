import { z } from 'zod';

export const organizationRoleSchema = z.enum([
  'OWNER',
  'MANAGER',
  'CASHIER',
  'MERCHANT',
]);

export const addOrganizationMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address.')
    .max(254, 'Email must be 254 characters or fewer.'),
  role: organizationRoleSchema,
});
