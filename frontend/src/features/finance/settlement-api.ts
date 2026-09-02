import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import type {
  FinanceEntryInput,
  LiveMerchantPayable,
  PayoutInput,
  SettlementDetail,
  SettlementFilters,
  SettlementPage,
} from './settlement.types';

function basePath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/settlements`;
}

export function listLivePayables(
  request: AuthenticatedRequest,
  organizationId: string,
  filters: { merchantId?: string; branchId?: string } = {},
): Promise<LiveMerchantPayable[]> {
  const query = new URLSearchParams(filters);
  return request(
    `${basePath(organizationId)}/payables${query.size ? `?${query}` : ''}`,
  );
}

export function closeLivePayable(
  request: AuthenticatedRequest,
  organizationId: string,
  merchantId: string,
): Promise<SettlementDetail> {
  return write(
    request,
    `${basePath(organizationId)}/payables/${merchantId}/close`,
    'POST',
  );
}

export function addFinanceEntry(
  request: AuthenticatedRequest,
  organizationId: string,
  merchantId: string,
  input: FinanceEntryInput,
): Promise<LiveMerchantPayable> {
  return request(`${basePath(organizationId)}/payables/${merchantId}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

function write(
  request: AuthenticatedRequest,
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  input?: unknown,
): Promise<SettlementDetail> {
  return request<SettlementDetail>(path, {
    method,
    headers: input ? { 'Content-Type': 'application/json' } : undefined,
    body: input ? JSON.stringify(input) : undefined,
  });
}

export function listSettlements(
  request: AuthenticatedRequest,
  organizationId: string,
  filters: SettlementFilters = {},
): Promise<SettlementPage> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return request<SettlementPage>(
    `${basePath(organizationId)}${query.size ? `?${query}` : ''}`,
  );
}

export function getSettlement(
  request: AuthenticatedRequest,
  organizationId: string,
  settlementId: string,
): Promise<SettlementDetail> {
  return request(
    `${basePath(organizationId)}/${encodeURIComponent(settlementId)}`,
  );
}

export function settlementAction(
  request: AuthenticatedRequest,
  organizationId: string,
  settlementId: string,
  action: 'approve',
): Promise<SettlementDetail> {
  return write(
    request,
    `${basePath(organizationId)}/${encodeURIComponent(settlementId)}/${action}`,
    'POST',
  );
}

export function removeFinanceEntry(
  request: AuthenticatedRequest,
  organizationId: string,
  merchantId: string,
  entryId: string,
): Promise<LiveMerchantPayable> {
  return request(
    `${basePath(organizationId)}/payables/${merchantId}/entries/${entryId}`,
    { method: 'DELETE' },
  );
}

export function recordPayout(
  request: AuthenticatedRequest,
  organizationId: string,
  settlementId: string,
  input: PayoutInput,
): Promise<SettlementDetail> {
  return write(
    request,
    `${basePath(organizationId)}/${settlementId}/payout`,
    'POST',
    input,
  );
}
