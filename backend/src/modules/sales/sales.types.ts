import { Prisma } from '../../generated/prisma/client';

export const saleResponseInclude = {
  branch: { select: { id: true, name: true, code: true } },
  cashier: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  items: { orderBy: [{ id: 'asc' as const }] },
  payments: { orderBy: [{ paidAt: 'asc' as const }, { id: 'asc' as const }] },
} satisfies Prisma.SaleInclude;

export type SaleResponseRow = Prisma.SaleGetPayload<{
  include: typeof saleResponseInclude;
}>;

export interface SaleItemRecord extends Omit<
  SaleResponseRow['items'][number],
  'unitPrice' | 'subtotal' | 'discountAmount' | 'total'
> {
  unitPrice: string;
  subtotal: string;
  discountAmount: string;
  total: string;
}

export interface PaymentRecord extends Omit<
  SaleResponseRow['payments'][number],
  'amount'
> {
  amount: string;
}

export interface SaleRecord extends Omit<
  SaleResponseRow,
  'subtotal' | 'discountTotal' | 'total' | 'items' | 'payments'
> {
  subtotal: string;
  discountTotal: string;
  total: string;
  items: SaleItemRecord[];
  payments: PaymentRecord[];
}

export const saleSummarySelect = {
  id: true,
  organizationId: true,
  branchId: true,
  cashierId: true,
  saleNumber: true,
  subtotal: true,
  discountTotal: true,
  total: true,
  completedAt: true,
  cashier: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  payments: { select: { method: true } },
  _count: { select: { items: true } },
} satisfies Prisma.SaleSelect;

export type SaleSummaryRow = Prisma.SaleGetPayload<{
  select: typeof saleSummarySelect;
}>;

export interface SaleSummaryRecord extends Omit<
  SaleSummaryRow,
  'subtotal' | 'discountTotal' | 'total' | 'payments' | '_count'
> {
  subtotal: string;
  discountTotal: string;
  total: string;
  itemCount: number;
  paymentMethods: SaleSummaryRow['payments'][number]['method'][];
}

export interface SalePageRecord {
  items: SaleSummaryRecord[];
  total: number;
  offset: number;
  limit: number;
}
