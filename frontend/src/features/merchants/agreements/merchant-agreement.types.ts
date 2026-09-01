export type SettlementSchedule = 'WEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY';
export type AgreementStatus = 'DRAFT' | 'ACTIVE' | 'ENDED';
export type RentCollectionMethod = 'DEDUCT_FROM_PAYOUT' | 'PAID_SEPARATELY';
export type RentDeductionTiming =
  | 'FIRST_SETTLEMENT_OF_MONTH'
  | 'LAST_SETTLEMENT_OF_MONTH'
  | 'PRORATED_PER_SETTLEMENT';

export interface MerchantAgreement {
  id: string;
  organizationId: string;
  merchantId: string;
  startDate: string;
  endDate: string | null;
  fixedRentAmount: string | null;
  commissionRate: string | null;
  settlementSchedule: SettlementSchedule;
  rentCollectionMethod?: RentCollectionMethod;
  rentDeductionTiming?: RentDeductionTiming;
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
  startDate: string;
  endDate?: string;
  fixedRentAmount?: string;
  commissionRate?: string;
  settlementSchedule: SettlementSchedule;
  rentCollectionMethod?: RentCollectionMethod;
  rentDeductionTiming?: RentDeductionTiming;
}

export interface MerchantAgreementUpdateInput {
  startDate: string;
  endDate: string | null;
  fixedRentAmount: string | null;
  commissionRate: string | null;
  settlementSchedule: SettlementSchedule;
  rentCollectionMethod?: RentCollectionMethod;
  rentDeductionTiming?: RentDeductionTiming;
}
