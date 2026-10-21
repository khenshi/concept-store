import type {
  AuthenticatedRequest,
  OrganizationRole,
} from '@/features/organizations/model/organization.types';
import type { PosScope } from '@/features/pos/model/pos.types';
import {
  branchRefundPageSchema,
  branchRefundQuerySchema,
} from '../model/branch-refunds';
import type { z } from 'zod';

export async function listBranchRefunds(
  request: AuthenticatedRequest,
  scope: PosScope,
  role: OrganizationRole,
  input: z.infer<typeof branchRefundQuerySchema>,
) {
  if (role !== 'OWNER' && role !== 'MANAGER')
    throw new Error('Your role cannot access refund history.');
  const query = branchRefundQuerySchema.parse(input);
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
  });
  for (const field of ['q', 'from', 'until', 'paymentMethod'] as const)
    if (query[field]) params.set(field, query[field]);
  const result = branchRefundPageSchema.parse(
    await request<unknown>(
      `/organizations/${encodeURIComponent(scope.organizationId)}/branches/${encodeURIComponent(scope.branchId)}/refunds?${params}`,
    ),
  );
  if (
    result.organizationId !== scope.organizationId ||
    result.branchId !== scope.branchId ||
    result.page !== query.page ||
    result.limit !== query.limit
  )
    throw new Error('Refund response scope is inconsistent.');
  return result;
}
