import { z } from 'zod';

export const paymentMethodSchema = z.enum([
  'CASH',
  'GCASH',
  'BANK_TRANSFER',
  'OTHER',
]);

export const checkoutPaymentSchema = z
  .object({
    method: paymentMethodSchema,
    referenceNumber: z
      .string()
      .trim()
      .max(120, 'Reference must contain 120 characters or fewer.'),
  })
  .superRefine((value, context) => {
    if (value.method !== 'CASH' && !value.referenceNumber) {
      context.addIssue({
        code: 'custom',
        path: ['referenceNumber'],
        message: 'Enter the payment reference for this method.',
      });
    }
  });
