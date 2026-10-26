import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import {
  paymentAccountSchema,
  type PaymentAccountInput,
} from '../model/payment-account';

function path(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/payment-accounts`;
}

export async function listPaymentAccounts(
  request: AuthenticatedRequest,
  organizationId: string,
) {
  return paymentAccountSchema
    .array()
    .parse(await request<unknown>(path(organizationId)));
}

export async function listBranchPaymentAccounts(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  operation: 'SALE' | 'REFUND' = 'SALE',
  history = false,
) {
  const params = new URLSearchParams({ operation });
  if (history) params.set('history', 'true');
  return paymentAccountSchema
    .array()
    .parse(
      await request<unknown>(
        `/organizations/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}/payment-accounts?${params}`,
      ),
    );
}

export async function createPaymentAccount(
  request: AuthenticatedRequest,
  organizationId: string,
  input: PaymentAccountInput,
) {
  return paymentAccountSchema.parse(
    await request<unknown>(path(organizationId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
}

export async function updatePaymentAccount(
  request: AuthenticatedRequest,
  organizationId: string,
  accountId: string,
  input: PaymentAccountInput & { version: number },
) {
  return paymentAccountSchema.parse(
    await request<unknown>(
      `${path(organizationId)}/${encodeURIComponent(accountId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    ),
  );
}
