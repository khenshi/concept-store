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

const optionalInteger = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.coerce.number().int('Quantity must be a whole number.').optional(),
);

export const inventoryAdjustmentSchema = z
  .object({
    productId: z.string().uuid(),
    branchId: z.string().uuid(),
    quantityChange: optionalInteger,
    newQuantity: optionalInteger,
    note: z
      .string()
      .trim()
      .min(1, 'Explain why the inventory is being adjusted.')
      .max(500, 'Note must contain 500 characters or fewer.'),
    referenceId: optionalText(120),
  })
  .superRefine((value, context) => {
    const hasDelta = value.quantityChange !== undefined;
    const hasTotal = value.newQuantity !== undefined;
    if (hasDelta === hasTotal) {
      context.addIssue({
        code: 'custom',
        path: ['quantityChange'],
        message: 'Enter either a quantity change or a new stock total.',
      });
    } else if (
      hasDelta &&
      (value.quantityChange === 0 ||
        Math.abs(value.quantityChange!) > 1_000_000_000)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['quantityChange'],
        message:
          'Quantity change must be non-zero and within the allowed range.',
      });
    } else if (
      hasTotal &&
      (value.newQuantity! < 0 || value.newQuantity! > 1_000_000_000)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['newQuantity'],
        message: 'New stock total must be between 0 and 1,000,000,000.',
      });
    }
  });
