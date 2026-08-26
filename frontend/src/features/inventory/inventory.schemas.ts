import { z } from 'zod';

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum, `Must contain ${maximum} characters or fewer.`)
    .transform((value) => value || undefined);

export const stockInSchema = z.object({
  productId: z.string().uuid('Select a product.'),
  branchId: z.string().uuid('Select a branch.'),
  quantity: z.coerce
    .number()
    .int('Quantity must be a whole number.')
    .min(1, 'Quantity must be at least 1.')
    .max(1_000_000_000, 'Quantity is too large.'),
  referenceId: optionalText(120),
  note: optionalText(500),
});

export const inventoryAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  branchId: z.string().uuid(),
  quantityChange: z.coerce
    .number()
    .int('Quantity change must be a whole number.')
    .min(-1_000_000_000, 'Quantity change is too small.')
    .max(1_000_000_000, 'Quantity change is too large.')
    .refine((value) => value !== 0, 'Quantity change cannot be zero.'),
  note: z
    .string()
    .trim()
    .min(1, 'Explain why the inventory is being adjusted.')
    .max(500, 'Note must contain 500 characters or fewer.'),
  referenceId: optionalText(120),
});
