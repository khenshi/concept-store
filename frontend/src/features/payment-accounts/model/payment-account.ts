import { z } from 'zod';

export const paymentAccountSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(100),
  enabled: z.boolean(),
  systemKey: z.literal('CASH').nullable(),
  requiresReference: z.boolean(),
  assignmentMode: z.enum(['ALL', 'SELECTED']),
  version: z.number().int().positive(),
  branchIds: z.array(z.uuid()).default([]),
  available: z.boolean().optional(),
});

export type PaymentAccount = z.infer<typeof paymentAccountSchema>;
export type PaymentAccountInput = {
  name: string;
  enabled: boolean;
  requiresReference: boolean;
  assignmentMode: 'ALL' | 'SELECTED';
  branchIds: string[];
};

export function validPaymentAccountInput(input: PaymentAccountInput): boolean {
  return (
    input.name.trim().length > 0 &&
    input.name.trim().length <= 100 &&
    (input.assignmentMode === 'ALL' || input.branchIds.length > 0)
  );
}
