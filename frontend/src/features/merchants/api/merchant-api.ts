import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import {
  merchantListResponseSchema,
  merchantResponseSchema,
} from '../model/merchant.schemas';
import type {
  Merchant,
  MerchantFilters,
  MerchantInput,
  MerchantStatus,
  MerchantUpdateInput,
} from '../model/merchant.types';

function merchantPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/merchants`;
}

function merchantDetailPath(
  organizationId: string,
  merchantId: string,
): string {
  return `${merchantPath(organizationId)}/${encodeURIComponent(merchantId)}`;
}

export async function listMerchants(
  request: AuthenticatedRequest,
  organizationId: string,
  filters: MerchantFilters = {},
): Promise<Merchant[]> {
  const query = new URLSearchParams();
  if (filters.q) query.set('q', filters.q);
  if (filters.status) query.set('status', filters.status);
  const suffix = query.size ? `?${query.toString()}` : '';
  return merchantListResponseSchema.parse(
    await request<unknown>(`${merchantPath(organizationId)}${suffix}`),
  );
}

export async function createMerchant(
  request: AuthenticatedRequest,
  organizationId: string,
  input: MerchantInput,
): Promise<Merchant> {
  return merchantResponseSchema.parse(
    await request<unknown>(merchantPath(organizationId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
}

export async function getMerchant(
  request: AuthenticatedRequest,
  organizationId: string,
  merchantId: string,
): Promise<Merchant> {
  return merchantResponseSchema.parse(
    await request<unknown>(merchantDetailPath(organizationId, merchantId)),
  );
}

export async function updateMerchant(
  request: AuthenticatedRequest,
  organizationId: string,
  merchantId: string,
  input: MerchantUpdateInput,
): Promise<Merchant> {
  return merchantResponseSchema.parse(
    await request<unknown>(merchantDetailPath(organizationId, merchantId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
}

export async function updateMerchantStatus(
  request: AuthenticatedRequest,
  organizationId: string,
  merchantId: string,
  status: MerchantStatus,
): Promise<Merchant> {
  return merchantResponseSchema.parse(
    await request<unknown>(
      `${merchantDetailPath(organizationId, merchantId)}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      },
    ),
  );
}
