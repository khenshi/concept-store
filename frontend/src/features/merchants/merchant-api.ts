import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import type {
  Merchant,
  MerchantFilters,
  MerchantInput,
  MerchantStatus,
  MerchantUpdateInput,
} from './merchant.types';

function merchantPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/merchants`;
}

export function listMerchants(
  request: AuthenticatedRequest,
  organizationId: string,
  filters: MerchantFilters = {},
): Promise<Merchant[]> {
  const query = new URLSearchParams();
  if (filters.search) query.set('search', filters.search);
  if (filters.status) query.set('status', filters.status);
  const suffix = query.size ? `?${query.toString()}` : '';
  return request<Merchant[]>(`${merchantPath(organizationId)}${suffix}`);
}

export function createMerchant(
  request: AuthenticatedRequest,
  organizationId: string,
  input: MerchantInput,
): Promise<Merchant> {
  return request<Merchant>(merchantPath(organizationId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function getMerchant(
  request: AuthenticatedRequest,
  organizationId: string,
  merchantId: string,
): Promise<Merchant> {
  return request<Merchant>(
    `${merchantPath(organizationId)}/${encodeURIComponent(merchantId)}`,
  );
}

export function updateMerchant(
  request: AuthenticatedRequest,
  organizationId: string,
  merchantId: string,
  input: MerchantUpdateInput,
): Promise<Merchant> {
  return request<Merchant>(
    `${merchantPath(organizationId)}/${encodeURIComponent(merchantId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}

export function updateMerchantStatus(
  request: AuthenticatedRequest,
  organizationId: string,
  merchantId: string,
  status: MerchantStatus,
): Promise<Merchant> {
  return request<Merchant>(
    `${merchantPath(organizationId)}/${encodeURIComponent(merchantId)}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  );
}
