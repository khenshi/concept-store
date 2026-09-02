import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import type {
  FinanceEntryInput,
  LiveMerchantPayable,
  LiveMerchantPayablePage,
  PayoutInput,
  PayoutMethod,
  SettlementDetail,
  SettlementFilters,
  SettlementPage,
  SettlementPreview,
  MerchantReceivable,
  MerchantReceivablePage,
} from './settlement.types';

function basePath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/settlements`;
}

export function listLivePayables(
  request: AuthenticatedRequest,
  organizationId: string,
  filters: {
    merchantId?: string;
    branchId?: string;
    offset?: number;
    limit?: number;
  } = {},
): Promise<LiveMerchantPayablePage> {
  const query = new URLSearchParams();
  if (filters.merchantId) query.set('merchantId', filters.merchantId);
  if (filters.branchId) query.set('branchId', filters.branchId);
  if (filters.offset !== undefined) query.set('offset', String(filters.offset));
  if (filters.limit !== undefined) query.set('limit', String(filters.limit));
  return request(
    `${basePath(organizationId)}/payables${query.size ? `?${query}` : ''}`,
  );
}

export function closeLivePayable(
  request: AuthenticatedRequest,
  organizationId: string,
  merchantId: string,
  rentDeductionAmount?: string,
): Promise<SettlementDetail> {
  return write(
    request,
    `${basePath(organizationId)}/payables/${merchantId}/close`,
    'POST',
    rentDeductionAmount ? { rentDeductionAmount } : {},
  );
}

export function previewLivePayable(
  request: AuthenticatedRequest,
  organizationId: string,
  merchantId: string,
  rentDeductionAmount?: string,
): Promise<SettlementPreview> {
  return request(`${basePath(organizationId)}/payables/${merchantId}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rentDeductionAmount ? { rentDeductionAmount } : {}),
  });
}

function receivablePath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/merchant-receivables`;
}

export function listMerchantReceivables(
  request: AuthenticatedRequest,
  organizationId: string,
  filters: { merchantId?: string; status?: string } = {},
): Promise<MerchantReceivablePage> {
  const query = new URLSearchParams();
  if (filters.merchantId) query.set('merchantId', filters.merchantId);
  if (filters.status) query.set('status', filters.status);
  return request(
    `${receivablePath(organizationId)}${query.size ? `?${query}` : ''}`,
  );
}

export function recordReceivablePayment(
  request: AuthenticatedRequest,
  organizationId: string,
  receivableId: string,
  input: {
    amount: string;
    method: PayoutMethod;
    paidAt: string;
    referenceNumber?: string;
    note?: string;
  },
): Promise<MerchantReceivable> {
  return request(`${receivablePath(organizationId)}/${receivableId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function adjustMerchantReceivable(
  request: AuthenticatedRequest,
  organizationId: string,
  receivableId: string,
  input: { amount: string; reason: string },
): Promise<MerchantReceivable> {
  return request(
    `${receivablePath(organizationId)}/${receivableId}/adjustments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
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
  action: 'review' | 'approve',
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
