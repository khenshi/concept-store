import { z } from 'zod';

const moneyPattern = /^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,9}(?:\.\d{1,2})?)$/;
const commissionPattern =
  /^(?:100(?:\.0{1,2})?|[1-9]\d?(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/;

function isBusinessDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const optionalDecimal = (pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || pattern.test(value), message);

export const merchantAgreementSchema = z
  .object({
    startDate: z.string().refine(isBusinessDate, 'Enter a valid start date.'),
    endDate: z
      .string()
      .refine(
        (value) => value === '' || isBusinessDate(value),
        'Enter a valid end date.',
      ),
    fixedRentAmount: optionalDecimal(
      moneyPattern,
      'Fixed rent must be positive and use at most 2 decimal places.',
    ),
    commissionRate: optionalDecimal(
      commissionPattern,
      'Commission must be greater than 0, no more than 100, and use at most 2 decimal places.',
    ),
    settlementSchedule: z.enum(['WEEKLY', 'SEMI_MONTHLY', 'MONTHLY']),
    rentCollectionMethod: z
      .enum(['DEDUCT_FROM_PAYOUT', 'PAID_SEPARATELY'])
      .default('DEDUCT_FROM_PAYOUT'),
    rentDeductionTiming: z
      .enum([
        'FIRST_SETTLEMENT_OF_MONTH',
        'LAST_SETTLEMENT_OF_MONTH',
        'PRORATED_PER_SETTLEMENT',
      ])
      .default('FIRST_SETTLEMENT_OF_MONTH'),
  })
  .superRefine((value, context) => {
    if (value.endDate && value.endDate < value.startDate) {
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'End date cannot be earlier than the start date.',
      });
    }
  });

export const endMerchantAgreementSchema = z.object({
  endDate: z.string().refine(isBusinessDate, 'Enter a valid end date.'),
});
