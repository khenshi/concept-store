import { z } from 'zod';

const requiredText = (label: string, maximum: number) =>
  z
    .string()
    .trim()
    .min(2, `${label} must contain at least 2 characters.`)
    .max(maximum, `${label} must contain ${maximum} characters or fewer.`);

export const merchantStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'ENDED',
]);

export const merchantProfileSchema = z.object({
  name: requiredText('Merchant name', 120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (value) => value === '' || /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(value),
      'Code may contain uppercase letters, numbers, and internal hyphens.',
    )
    .refine(
      (value) => value === '' || (value.length >= 2 && value.length <= 32),
      'Code must contain 2–32 characters.',
    )
    .transform((value) => value || undefined),
  contactName: requiredText('Contact name', 120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address.')
    .max(254, 'Email must contain 254 characters or fewer.'),
  phone: z
    .string()
    .trim()
    .regex(
      /^\+?[0-9][0-9 ()-]{6,24}$/,
      'Enter a valid telephone number using 7–25 characters.',
    ),
});

export const merchantBranchesSchema = z
  .array(z.string().uuid())
  .min(1, 'Select at least one branch.');

export const merchantSchema = merchantProfileSchema.extend({
  branchIds: merchantBranchesSchema,
});
