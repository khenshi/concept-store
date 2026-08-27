import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import type {
  MerchantAgreement,
  MerchantAgreementInput,
  MerchantAgreementUpdateInput,
} from './merchant-agreement.types';

function organizationPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}`;
}

export function listMerchantAgreements(
  request: AuthenticatedRequest,
  organizationId: string,
  merchantId: string,
): Promise<MerchantAgreement[]> {
  return request<MerchantAgreement[]>(
    `${organizationPath(organizationId)}/merchants/${encodeURIComponent(merchantId)}/agreements`,
  );
}

export function listOrganizationAgreements(
  request: AuthenticatedRequest,
  organizationId: string,
): Promise<MerchantAgreement[]> {
  return request<MerchantAgreement[]>(
    `${organizationPath(organizationId)}/merchant-agreements`,
  );
}

export function getMerchantAgreement(
  request: AuthenticatedRequest,
  organizationId: string,
  agreementId: string,
): Promise<MerchantAgreement> {
  return request<MerchantAgreement>(
    `${organizationPath(organizationId)}/merchant-agreements/${encodeURIComponent(agreementId)}`,
  );
}

export function createMerchantAgreement(
  request: AuthenticatedRequest,
  organizationId: string,
  merchantId: string,
  input: MerchantAgreementInput,
): Promise<MerchantAgreement> {
  return request<MerchantAgreement>(
    `${organizationPath(organizationId)}/merchants/${encodeURIComponent(merchantId)}/agreements`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}

export function updateMerchantAgreement(
  request: AuthenticatedRequest,
  organizationId: string,
  agreementId: string,
  input: MerchantAgreementUpdateInput,
): Promise<MerchantAgreement> {
  return request<MerchantAgreement>(
    `${organizationPath(organizationId)}/merchant-agreements/${encodeURIComponent(agreementId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}

export function activateMerchantAgreement(
  request: AuthenticatedRequest,
  organizationId: string,
  agreementId: string,
): Promise<MerchantAgreement> {
  return request<MerchantAgreement>(
    `${organizationPath(organizationId)}/merchant-agreements/${encodeURIComponent(agreementId)}/activate`,
    { method: 'PATCH' },
  );
}

export function endMerchantAgreement(
  request: AuthenticatedRequest,
  organizationId: string,
  agreementId: string,
  endDate: string,
): Promise<MerchantAgreement> {
  return request<MerchantAgreement>(
    `${organizationPath(organizationId)}/merchant-agreements/${encodeURIComponent(agreementId)}/end`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endDate }),
    },
  );
}
