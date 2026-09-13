import { z } from 'zod';
import { MERCHANT_STATUSES } from './merchant.types';

const requiredText = (label: string, maximum: number) =>
  z
    .string()
    .trim()
    .min(2, `${label} must contain at least 2 characters.`)
    .max(maximum, `${label} must contain ${maximum} characters or fewer.`);

const optionalCode = z
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
  .transform((value) => value || undefined);

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email must contain 254 characters or fewer.')
  .refine(
    (value) => value === '' || z.email().safeParse(value).success,
    'Enter a valid email address.',
  )
  .transform((value) => value || undefined);

export function isPhilippinePhoneNumber(value: string): boolean {
  const compact = value.replace(/[\s().-]/g, '');
  return (
    /^09\d{9}$/.test(compact) ||
    /^\+639\d{9}$/.test(compact) ||
    /^0[2-8]\d{7,9}$/.test(compact) ||
    /^\+63[2-8]\d{7,9}$/.test(compact)
  );
}

export const merchantFormSchema = z.object({
  name: requiredText('Business name', 120),
  code: optionalCode,
  contactName: requiredText('Contact name', 120),
  email: optionalEmail,
  phone: z
    .string()
    .trim()
    .min(7, 'Phone must contain at least 7 characters.')
    .max(30, 'Phone must contain 30 characters or fewer.')
    .refine(
      isPhilippinePhoneNumber,
      'Enter a valid Philippine mobile or telephone number.',
    ),
});

export const merchantStatusSchema = z.enum(MERCHANT_STATUSES);

export const merchantResponseSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  name: z.string(),
  code: z.string().nullable(),
  contactName: z.string(),
  email: z.string().nullable(),
  phone: z.string(),
  status: merchantStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const merchantListResponseSchema = z.array(merchantResponseSchema);
export const merchantSummarySchema = merchantResponseSchema.pick({
  id: true,
  name: true,
  code: true,
  status: true,
});
export const merchantViewSchema = z.union([
  merchantResponseSchema,
  merchantSummarySchema,
]);
export const merchantViewListSchema = z.array(merchantViewSchema);
