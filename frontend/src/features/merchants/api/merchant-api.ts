import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import {
  merchantListResponseSchema,
  merchantResponseSchema,
  merchantSummarySchema,
  merchantViewSchema,
  merchantViewListSchema,
} from '../model/merchant.schemas';
import type {
  Merchant,
  MerchantFilters,
  MerchantInput,
  MerchantStatus,
  MerchantUpdateInput,
  MerchantView,
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
  role?: string,
): Promise<MerchantView[]> {
  const query = new URLSearchParams();
  if (filters.q) query.set('q', filters.q);
  if (filters.status) query.set('status', filters.status);
  const suffix = query.size ? `?${query.toString()}` : '';
  const result = await request<unknown>(
    `${merchantPath(organizationId)}${suffix}`,
  );
  return role === 'MANAGER'
    ? merchantSummarySchema.array().parse(result)
    : role === 'OWNER' || role === 'MERCHANT'
      ? merchantListResponseSchema.parse(result)
      : merchantViewListSchema.parse(result);
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
  role?: string,
): Promise<MerchantView> {
  const result = await request<unknown>(
    merchantDetailPath(organizationId, merchantId),
  );
  return role === 'MANAGER'
    ? merchantSummarySchema.parse(result)
    : role === 'OWNER' || role === 'MERCHANT'
      ? merchantResponseSchema.parse(result)
      : merchantViewSchema.parse(result);
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
