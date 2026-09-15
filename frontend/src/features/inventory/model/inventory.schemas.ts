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
export const stockStatusSchema = z.enum([
  'IN_STOCK',
  'LOW_STOCK',
  'OUT_OF_STOCK',
]);
export const lowStockThresholdInputSchema = z
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
  );
export const thresholdInputSchema = z.object({
  lowStockThreshold: lowStockThresholdInputSchema,
});
export const placementInputSchema = priceInputSchema.extend({
  productId: z.uuidv4('Choose an active product.'),
  lowStockThreshold: lowStockThresholdInputSchema,
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
  lowStockThreshold: z.number().int().min(0).max(2147483647),
  stockStatus: stockStatusSchema,
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
export const inventoryHealthSummarySchema = z.object({
  inStock: z.number().int().min(0),
  lowStock: z.number().int().min(0),
  outOfStock: z.number().int().min(0),
});
const movementObjectSchema = z.object({
  id: z.uuidv4(),
  organizationId: z.uuidv4(),
  branchId: z.uuidv4(),
  branchInventoryId: z.uuidv4(),
  type: z.enum(['RECEIPT', 'ADJUSTMENT', 'SALE', 'RETURN']),
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
});
const validReceipt = (value: { type: string; quantityChange: number }) =>
  (value.type !== 'RECEIPT' || value.quantityChange > 0) &&
  (value.type !== 'RETURN' || value.quantityChange > 0) &&
  (value.type !== 'SALE' || value.quantityChange < 0);
export const merchantMovementSchema = movementObjectSchema
  .omit({ createdById: true })
  .refine(
    validReceipt,
    'Receipt/return delta must be positive; sale delta must be negative.',
  );
export const movementResponseSchema = movementObjectSchema.refine(
  validReceipt,
  'Receipt/return delta must be positive; sale delta must be negative.',
);
export const movementListSchema = z.array(movementResponseSchema);
export const inventoryBranchSchema = z.object({
  id: z.uuidv4(),
  organizationId: z.uuidv4().optional(),
  name: z.string(),
  code: z.string().nullable(),
});
