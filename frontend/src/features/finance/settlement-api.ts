import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import type {
  AdjustmentInput,
  GenerateSettlementInput,
  PayoutInput,
  SettlementDetail,
  SettlementFilters,
  SettlementMetrics,
  SettlementPage,
} from './settlement.types';

function basePath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/settlements`;
}

export function getSettlementSummary(
  request: AuthenticatedRequest,
  organizationId: string,
  filters: SettlementFilters = {},
): Promise<SettlementMetrics> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return request(
    `${basePath(organizationId)}/summary${query.size ? `?${query}` : ''}`,
  );
}

export function generateOffCycleSettlement(
  request: AuthenticatedRequest,
  organizationId: string,
  input: GenerateSettlementInput & { reason: string },
): Promise<SettlementDetail> {
  return write(request, `${basePath(organizationId)}/off-cycle`, 'POST', input);
}

export function generateMissingSettlements(
  request: AuthenticatedRequest,
  organizationId: string,
): Promise<{ generated: number; skipped: number }> {
  return request(`${basePath(organizationId)}/generate-missing`, {
    method: 'POST',
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

export function generateSettlement(
  request: AuthenticatedRequest,
  organizationId: string,
  input: GenerateSettlementInput,
): Promise<SettlementDetail> {
  return write(request, basePath(organizationId), 'POST', input);
}

export function settlementAction(
  request: AuthenticatedRequest,
  organizationId: string,
  settlementId: string,
  action: 'recalculate' | 'review' | 'return-to-draft' | 'approve',
): Promise<SettlementDetail> {
  return write(
    request,
    `${basePath(organizationId)}/${encodeURIComponent(settlementId)}/${action}`,
    'POST',
  );
}

export function addAdjustment(
  request: AuthenticatedRequest,
  organizationId: string,
  settlementId: string,
  input: AdjustmentInput,
): Promise<SettlementDetail> {
  return write(
    request,
    `${basePath(organizationId)}/${settlementId}/adjustments`,
    'POST',
    input,
  );
}

export function removeAdjustment(
  request: AuthenticatedRequest,
  organizationId: string,
  settlementId: string,
  adjustmentId: string,
): Promise<SettlementDetail> {
  return write(
    request,
    `${basePath(organizationId)}/${settlementId}/adjustments/${adjustmentId}`,
    'DELETE',
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
