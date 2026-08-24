import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Organization name must contain at least 2 characters.')
    .max(120, 'Organization name must contain 120 characters or fewer.'),
});
