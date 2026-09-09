import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import type {
  MerchantAgreement,
  MerchantAgreementInput,
  MerchantAgreementUpdateInput,
  PrepaymentKind,
  SpaceAvailability,
} from './merchant-agreement.types';

const base = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}`;
const agreementPath = (organizationId: string, agreementId: string) =>
  `${base(organizationId)}/merchant-agreements/${encodeURIComponent(agreementId)}`;

export const listMerchantAgreements = (
  request: AuthenticatedRequest,
  organizationId: string,
  merchantId: string,
) =>
  request<MerchantAgreement[]>(
    `${base(organizationId)}/merchants/${encodeURIComponent(merchantId)}/agreements`,
  );
export const listOrganizationAgreements = (
  request: AuthenticatedRequest,
  organizationId: string,
) =>
  request<MerchantAgreement[]>(`${base(organizationId)}/merchant-agreements`);
export const createMerchantAgreement = (
  request: AuthenticatedRequest,
  organizationId: string,
  merchantId: string,
  input: MerchantAgreementInput,
) =>
  request<MerchantAgreement>(
    `${base(organizationId)}/merchants/${encodeURIComponent(merchantId)}/agreements`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
export const updateMerchantAgreement = (
  request: AuthenticatedRequest,
  organizationId: string,
  agreementId: string,
  input: MerchantAgreementUpdateInput,
) =>
  request<MerchantAgreement>(agreementPath(organizationId, agreementId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

export function transitionAgreement(
  request: AuthenticatedRequest,
  organizationId: string,
  agreementId: string,
  action:
    | 'submit'
    | 'withdraw'
    | 'return-to-draft'
    | 'approve'
    | 'activate'
    | 'discard'
    | 'suspend',
  body?: object,
) {
  return request<MerchantAgreement>(
    `${agreementPath(organizationId, agreementId)}/${action}`,
    {
      method: action === 'submit' ? 'POST' : 'PATCH',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
}

export function listSpaceAvailability(
  request: AuthenticatedRequest,
  organizationId: string,
  activationAt: string,
  durationMonths: number,
  excludeAgreementId?: string,
) {
  const query = new URLSearchParams({
    activationAt,
    durationMonths: String(durationMonths),
  });
  if (excludeAgreementId) query.set('excludeAgreementId', excludeAgreementId);
  return request<SpaceAvailability[]>(
    `${base(organizationId)}/spaces/availability?${query}`,
  );
}

export interface CollectionInput {
  amount: string;
  method: string;
  referenceNumber?: string;
  occurredAt: string;
  requestId: string;
}
export function collectAgreementPrepayment(
  request: AuthenticatedRequest,
  organizationId: string,
  agreementId: string,
  kind: PrepaymentKind,
  input: CollectionInput,
) {
  return request(
    `${agreementPath(organizationId, agreementId)}/prepayments/${kind}/collections`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}

export function refundAgreementPrepayment(
  request: AuthenticatedRequest,
  organizationId: string,
  agreementId: string,
  kind: PrepaymentKind,
  input: CollectionInput & { reason: string },
) {
  return request(
    `${agreementPath(organizationId, agreementId)}/prepayments/${kind}/refunds`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}

export function deductSecurityDeposit(
  request: AuthenticatedRequest,
  organizationId: string,
  agreementId: string,
  amount: string,
  reason: string,
) {
  return request(
    `${agreementPath(organizationId, agreementId)}/security-deposit/deductions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, reason, requestId: crypto.randomUUID() }),
    },
  );
}
