import { z } from 'zod';

const pricePattern = /^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,9}(?:\.\d{1,2})?)$/;

export const productSchema = z.object({
  merchantId: z.string().uuid('Select a merchant.'),
  name: z
    .string()
    .trim()
    .min(2, 'Product name must contain at least 2 characters.')
    .max(160, 'Product name must contain 160 characters or fewer.'),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'SKU must contain at least 2 characters.')
    .max(32, 'SKU must contain 32 characters or fewer.')
    .regex(
      /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/,
      'SKU may contain letters, numbers, and internal hyphens.',
    ),
  barcode: z
    .string()
    .trim()
    .max(64, 'Barcode must contain 64 characters or fewer.')
    .transform((value) => value || null),
  sellingPrice: z
    .string()
    .trim()
    .regex(pricePattern, 'Enter a positive price with at most 2 decimals.'),
});
