import { z } from 'zod';
import { merchantStatusSchema } from '@/features/merchants/model/merchant.schemas';
import { productStatusSchema } from '@/features/products/model/product.schemas';

export const inventoryPriceSchema = z
  .string()
  .trim()
  .regex(
    /^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/,
    'Enter a positive PHP price with up to two decimal places (maximum 9999999999.99).',
  );
export const priceInputSchema = z.object({
  sellingPrice: inventoryPriceSchema,
});
export const placementInputSchema = priceInputSchema.extend({
  productId: z.uuidv4('Choose an active product.'),
});
const integerInput = z
  .string()
  .trim()
  .regex(/^[+-]?\d+$/, 'Enter a whole number.')
  .transform(Number)
  .pipe(
    z
      .number()
      .int()
      .min(-2147483648, 'Quantity is outside the allowed range.')
      .max(2147483647, 'Quantity is outside the allowed range.'),
  );
const reasonSchema = z
  .string()
  .trim()
  .min(2, 'Reason must contain at least 2 characters.')
  .max(500, 'Reason must contain 500 characters or fewer.');
export const receiptInputSchema = z.object({
  quantity: integerInput.pipe(z.number().min(1, 'Receive at least one unit.')),
  reason: reasonSchema,
});
export const adjustmentInputSchema = z.object({
  quantityChange: integerInput.refine(
    (value) => value !== 0,
    'Adjustment cannot be zero.',
  ),
  reason: reasonSchema,
});
export const inventoryResponseSchema = z.object({
  id: z.uuidv4(),
  organizationId: z.uuidv4(),
  branchId: z.uuidv4(),
  productId: z.uuidv4(),
  sellingPrice: z.string().regex(/^(?=.*[1-9])\d{1,10}\.\d{2}$/),
  quantity: z.number().int().min(0).max(2147483647),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  product: z.object({
    id: z.uuidv4(),
    merchantId: z.uuidv4(),
    name: z.string(),
    sku: z.string().nullable(),
    barcode: z.string().nullable(),
    status: productStatusSchema,
    merchant: z.object({
      id: z.uuidv4(),
      name: z.string(),
      status: merchantStatusSchema,
    }),
  }),
});
export const inventoryListSchema = z.array(inventoryResponseSchema);
export const movementResponseSchema = z
  .object({
    id: z.uuidv4(),
    organizationId: z.uuidv4(),
    branchId: z.uuidv4(),
    branchInventoryId: z.uuidv4(),
    type: z.enum(['RECEIPT', 'ADJUSTMENT']),
    quantityChange: z
      .number()
      .int()
      .min(-2147483648)
      .max(2147483647)
      .refine((value) => value !== 0),
    quantityAfter: z.number().int().min(0).max(2147483647),
    reason: z.string(),
    createdById: z.uuidv4(),
    requestId: z.uuidv4(),
    createdAt: z.iso.datetime(),
  })
  .refine(
    (value) => value.type !== 'RECEIPT' || value.quantityChange > 0,
    'Receipt delta must be positive.',
  );
export const movementListSchema = z.array(movementResponseSchema);
export const inventoryBranchSchema = z.object({
  id: z.uuidv4(),
  organizationId: z.uuidv4(),
  name: z.string(),
  code: z.string().nullable(),
});
