import { z } from 'zod';

export const branchStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const branchIdentitySchema = z.object({
  id: z.uuidv4(),
  name: z.string(),
  code: z.string().nullable(),
});
export const branchResponseSchema = branchIdentitySchema.extend({
  status: branchStatusSchema,
  organizationId: z.uuidv4(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  province: z.string(),
  postalCode: z.string().nullable(),
  countryCode: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const branchViewSchema = z.union([
  branchResponseSchema,
  branchIdentitySchema,
]);

export const branchDirectoryItemSchema = branchResponseSchema.extend({
  merchantCount: z.number().int().nonnegative(),
});

export const branchDirectoryPageSchema = z
  .object({
    items: branchDirectoryItemSchema.array(),
    page: z.number().int().positive(),
    limit: z.literal(15),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNext: z.boolean(),
    summary: z.object({
      total: z.number().int().nonnegative(),
      active: z.number().int().nonnegative(),
      inactive: z.number().int().nonnegative(),
    }),
  })
  .superRefine((page, context) => {
    if (page.totalPages !== Math.ceil(page.total / page.limit))
      context.addIssue({
        code: 'custom',
        path: ['totalPages'],
        message: 'Branch pagination is inconsistent.',
      });
    if (page.hasNext !== page.page < page.totalPages)
      context.addIssue({
        code: 'custom',
        path: ['hasNext'],
        message: 'Branch pagination state is inconsistent.',
      });
    if (page.summary.total !== page.summary.active + page.summary.inactive)
      context.addIssue({
        code: 'custom',
        path: ['summary'],
        message: 'Branch summary is inconsistent.',
      });
  });

const requiredText = (label: string, maximum: number) =>
  z
    .string()
    .trim()
    .min(2, `${label} must contain at least 2 characters.`)
    .max(maximum, `${label} must contain ${maximum} characters or fewer.`);

const optionalText = (label: string, maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum, `${label} must contain ${maximum} characters or fewer.`)
    .transform((value) => value || undefined);

export const branchSchema = z.object({
  name: requiredText('Branch name', 120),
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
  addressLine1: requiredText('Address line 1', 200),
  addressLine2: optionalText('Address line 2', 200),
  city: requiredText('City', 100),
  province: requiredText('Province', 100),
  postalCode: optionalText('Postal code', 20),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Enter a two-letter country code.'),
});
