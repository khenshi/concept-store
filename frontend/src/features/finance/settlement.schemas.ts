import { z } from 'zod';

export const adjustmentSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(
      /^-?(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,11}(?:\.\d{1,2})?)$/,
      'Enter a non-zero amount with up to 2 decimals.',
    ),
  reason: z.string().trim().min(1, 'Enter a reason.').max(500),
});

export const financeEntrySchema = adjustmentSchema
  .extend({
    type: z.enum(['ADJUSTMENT', 'MERCHANT_PAYMENT']),
  })
  .superRefine((value, context) => {
    if (value.type === 'MERCHANT_PAYMENT' && Number(value.amount) <= 0) {
      context.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'Merchant payments must be greater than zero.',
      });
    }
  });

export const payoutSchema = z
  .object({
    method: z.enum(['CASH', 'GCASH', 'BANK_TRANSFER', 'OTHER']),
    referenceNumber: z.string().trim().max(120),
    note: z.string().trim().max(500),
    paidAt: z.string().min(1, 'Enter the payout date and time.'),
  })
  .superRefine((value, context) => {
    if (value.method !== 'CASH' && !value.referenceNumber) {
      context.addIssue({
        code: 'custom',
        path: ['referenceNumber'],
        message: 'Enter a payment reference.',
      });
    }
  });
