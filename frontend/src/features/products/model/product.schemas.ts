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
export const productCreateFieldsSchema = productProfileSchema.extend({
  merchantId: z.uuidv4('Choose an active merchant.'),
  initialInventory: z
    .object({
      branchId: z.uuidv4('Choose a branch for the initial stock.'),
      sellingPrice: z
        .string()
        .trim()
        .regex(
          /^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/,
          'Enter a positive PHP price with up to two decimal places (maximum 9999999999.99).',
        ),
      quantity: z
        .union([
          z.number(),
          z
            .string()
            .trim()
            .regex(/^\d+$/, 'Enter a positive whole number.')
            .transform(Number),
        ])
        .pipe(
          z
            .number()
            .int()
            .min(1, 'Initial stock must be at least one unit.')
            .max(2147483647, 'Initial stock cannot exceed 2147483647 units.'),
        ),
      lowStockThreshold: z
        .union([
          z.number(),
          z
            .string()
            .trim()
            .regex(/^\d+$/, 'Enter a whole number from 0 to 2147483647.')
            .transform(Number),
        ])
        .pipe(
          z
            .number()
            .int()
            .min(0, 'Threshold cannot be negative.')
            .max(2147483647, 'Threshold cannot exceed 2147483647.'),
        )
        .default(5),
    })
    .optional(),
});
export const productCreateSchema = productCreateFieldsSchema
  .extend({ requestId: z.uuidv4().optional() })
  .superRefine((input, context) => {
    if (Boolean(input.initialInventory) !== Boolean(input.requestId))
      context.addIssue({
        code: 'custom',
        path: ['requestId'],
        message: 'Initial stock requires its creation request ID.',
      });
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
  lowStockThreshold: z.number().int().min(0).max(2147483647),
  stockStatus: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']),
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
