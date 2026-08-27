import { z } from 'zod';

export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'Enter your first name.')
    .max(80, 'First name must be 80 characters or fewer.'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Enter your last name.')
    .max(80, 'Last name must be 80 characters or fewer.'),
  phone: z
    .string()
    .trim()
    .max(25, 'Phone number must be 25 characters or fewer.')
    .optional()
    .transform((value) => value || undefined),
});

export type UpdateProfileValues = z.infer<typeof updateProfileSchema>;
