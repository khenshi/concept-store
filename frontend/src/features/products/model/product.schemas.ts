import { z } from 'zod';

export const productStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export const productProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must contain at least 2 characters.')
    .max(120, 'Name must contain 120 characters or fewer.'),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (value) =>
        value === '' ||
        (value.length >= 2 &&
          value.length <= 32 &&
          /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(value)),
      'SKU must contain 2–32 letters, numbers, or internal hyphens.',
    )
    .transform((value) => value || null),
  barcode: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === '' || (value.length <= 64 && /^[A-Za-z0-9-]+$/.test(value)),
      'Barcode must contain up to 64 letters, numbers, or hyphens.',
    )
    .transform((value) => value || null),
});
export const productCreateSchema = productProfileSchema.extend({
  merchantId: z.uuidv4('Choose an active merchant.'),
});
export const productResponseSchema = z.object({
  id: z.uuidv4(),
  organizationId: z.uuidv4(),
  merchantId: z.uuidv4(),
  name: z.string(),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  status: productStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const productListResponseSchema = z.array(productResponseSchema);
export const productPlacementResponseSchema = z.object({
  id: z.uuidv4(),
  organizationId: z.uuidv4(),
  branchId: z.uuidv4(),
  productId: z.uuidv4(),
  sellingPrice: z.string().regex(/^(?=.*[1-9])\d{1,10}\.\d{2}$/),
  quantity: z.number().int().min(0).max(2147483647),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  branch: z.object({
    id: z.uuidv4(),
    name: z.string(),
    code: z.string().nullable(),
  }),
});
export const productPlacementListSchema = z.array(
  productPlacementResponseSchema,
);
