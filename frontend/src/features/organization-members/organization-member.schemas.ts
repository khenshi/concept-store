import { z } from 'zod';

export const organizationRoleSchema = z.enum([
  'OWNER',
  'MANAGER',
  'CASHIER',
  'MERCHANT',
]);
