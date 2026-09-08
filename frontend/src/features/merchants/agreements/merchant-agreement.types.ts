export type SettlementSchedule = 'WEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY';
export type AgreementStatus = 'DRAFT' | 'ACTIVE' | 'ENDED';

export interface MerchantAgreement {
  id: string;
  organizationId: string;
  merchantId: string;
  startDate: string;
  endDate: string | null;
  durationMonths: number | null;
  activatedAt?: string | null;
  scheduledEndDate?: string | null;
  fixedRentAmount: string | null;
  commissionRate: string | null;
  settlementSchedule: SettlementSchedule;
  status: AgreementStatus;
  createdAt: string;
  updatedAt: string;
  merchant?: {
    id: string;
    name: string;
    code: string | null;
  };
}

export type AgreementType = 'FIXED_RENT' | 'COMMISSION' | 'HYBRID' | 'UNSET';

export interface MerchantAgreementInput {
  durationMonths?: number;
  startDate?: string;
  endDate?: string;
  fixedRentAmount?: string;
  commissionRate?: string;
  settlementSchedule: SettlementSchedule;
}

export interface MerchantAgreementUpdateInput {
  durationMonths?: number;
  startDate?: string;
  endDate?: string | null;
  fixedRentAmount: string | null;
  commissionRate: string | null;
  settlementSchedule: SettlementSchedule;
}
