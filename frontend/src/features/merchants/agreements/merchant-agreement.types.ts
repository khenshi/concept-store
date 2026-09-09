export type SettlementSchedule = 'WEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY';
export type AgreementStatus =
  'DRAFT' | 'PENDING' | 'APPROVED' | 'ACTIVE' | 'ENDED' | 'SUSPENDED';
export type RentDueWeek = 'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH' | 'LAST';
export type RentDueWeekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';
export type PrepaymentKind = 'SECURITY_DEPOSIT' | 'FIRST_RENT';
export type PrepaymentTransactionType =
  'COLLECTION' | 'REFUND' | 'DEDUCTION' | 'RETENTION' | 'APPLICATION';

export interface AgreementPrepaymentTransaction {
  id: string;
  type: PrepaymentTransactionType;
  amount: string;
  paymentMethod: string | null;
  referenceNumber: string | null;
  reason: string | null;
  occurredAt: string;
}

export interface AgreementPrepayment {
  id: string;
  kind: PrepaymentKind;
  requiredAmount: string;
  appliedAt: string | null;
  transactions: AgreementPrepaymentTransaction[];
}

export interface AgreementSpace {
  id: string;
  spaceId: string;
  branchId: string;
  periodStart: string;
  periodEnd: string;
  releasedAt: string | null;
  space: { id: string; code: string; name: string; branchId: string };
}

export interface MerchantAgreement {
  id: string;
  organizationId: string;
  merchantId: string;
  activationAt: string;
  draftSlot: number | null;
  startDate: string;
  endDate: string | null;
  durationMonths: number | null;
  fixedRentAmount: string | null;
  commissionRate: string | null;
  securityDepositAmount: string | null;
  firstRentPaymentRequired: boolean;
  rentDueWeek: RentDueWeek | null;
  rentDueWeekday: RentDueWeekday | null;
  settlementSchedule: SettlementSchedule;
  status: AgreementStatus;
  activationFailureReason: string | null;
  submittedAt: string | null;
  submittedById: string | null;
  approvedAt: string | null;
  approvedById: string | null;
  activatedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  returnedAt: string | null;
  returnReason: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  spaceReservations: AgreementSpace[];
  prepayments: AgreementPrepayment[];
  createdAt: string;
  updatedAt: string;
  merchant?: { id: string; name: string; code: string | null };
}

export interface MerchantAgreementInput {
  activationAt: string;
  durationMonths: number;
  spaceIds: string[];
  fixedRentAmount?: string;
  commissionRate?: string;
  securityDepositAmount?: string;
  firstRentPaymentRequired?: boolean;
  rentDueWeek?: RentDueWeek;
  rentDueWeekday?: RentDueWeekday;
  settlementSchedule: SettlementSchedule;
}

export type MerchantAgreementUpdateInput = Partial<MerchantAgreementInput>;
export type AgreementType = 'FIXED_RENT' | 'COMMISSION' | 'HYBRID' | 'UNSET';

export interface SpaceAvailability {
  id: string;
  branchId: string;
  code: string;
  name: string;
  branch: { id: string; name: string };
  available: boolean;
  conflictStatus: AgreementStatus | 'LEGACY' | null;
  conflictStartDate: string | null;
  conflictEndDate: string | null;
}
