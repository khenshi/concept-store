import { z } from 'zod';

export const posCodeSchema = z
  .string()
  .trim()
  .min(1, 'Enter a SKU or barcode.')
  .max(64, 'Code must contain 64 characters or fewer.')
  .regex(/^[A-Za-z0-9-]+$/, 'Use only letters, numbers and hyphens.');
export const posQuantitySchema = z
  .string()
  .trim()
  .regex(/^\d+$/, 'Enter a positive whole number.')
  .transform(Number)
  .pipe(
    z
      .number()
      .int()
      .min(1, 'Quantity must be at least one.')
      .max(2147483647, 'Quantity exceeds the allowed limit.'),
  );
export const posProductSchema = z
  .object({
    branchInventoryId: z.uuidv4(),
    productId: z.uuidv4(),
    name: z.string().min(2).max(120),
    sku: z.string().max(32).nullable(),
    barcode: z.string().max(64).nullable(),
    merchantName: z.string().min(2).max(120),
    sellingPrice: z.string().regex(/^(?=.*[1-9])\d{1,10}\.\d{2}$/),
    quantity: z.number().int().min(0).max(2147483647),
    eligible: z.boolean(),
  })
  .refine(
    (row) => row.eligible === row.quantity > 0,
    'Stock eligibility is inconsistent.',
  );
const distinct = (rows: z.infer<typeof posProductSchema>[]) =>
  new Set(rows.map((row) => row.branchInventoryId)).size === rows.length &&
  new Set(rows.map((row) => row.productId)).size === rows.length;
export const posCatalogSchema = z
  .array(posProductSchema)
  .max(100)
  .refine(distinct, 'Duplicate POS products.');
export const posCodeMatchesSchema = z
  .array(posProductSchema)
  .max(2)
  .refine(distinct, 'Duplicate code matches.');
