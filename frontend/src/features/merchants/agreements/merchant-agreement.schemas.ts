import { z } from 'zod';

const money = z
  .string()
  .trim()
  .regex(/^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,9}(?:\.\d{1,2})?)$/)
  .or(z.literal(''));

export const merchantAgreementSchema = z
  .object({
    activationAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose an activation date.'),
    durationMonths: z.coerce.number().int().min(1).max(60),
    spaceIds: z.array(z.string().uuid()).min(1, 'Select at least one space.'),
    fixedRentAmount: money,
    commissionRate: money,
    securityDepositAmount: money,
    firstRentPaymentRequired: z.boolean(),
    rentDueWeek: z
      .enum(['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'LAST'])
      .or(z.literal('')),
    rentDueWeekday: z
      .enum([
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
        'SUNDAY',
      ])
      .or(z.literal('')),
    settlementSchedule: z.enum(['WEEKLY', 'SEMI_MONTHLY', 'MONTHLY']),
  })
  .superRefine((value, context) => {
    if (!value.fixedRentAmount && !value.commissionRate)
      context.addIssue({
        code: 'custom',
        path: ['fixedRentAmount'],
        message: 'Enter rent, commission, or both.',
      });
    if (value.fixedRentAmount && (!value.rentDueWeek || !value.rentDueWeekday))
      context.addIssue({
        code: 'custom',
        path: ['rentDueWeek'],
        message: 'Choose the rent collection week and weekday.',
      });
    if (!value.fixedRentAmount && value.firstRentPaymentRequired)
      context.addIssue({
        code: 'custom',
        path: ['firstRentPaymentRequired'],
        message: 'First-rent prepayment requires fixed rent.',
      });
  });

export const reasonSchema = z.string().trim().min(1).max(500);
