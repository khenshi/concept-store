import { Prisma } from '../../../generated/prisma/client';

export const completedSaleSelect = {
  id: true,
  organizationId: true,
  branchId: true,
  receiptCode: true,
  completedAt: true,
  organizationName: true,
  branchName: true,
  branchCode: true,
  cashierName: true,
  paymentMethod: true,
  cashTender: true,
  cashChange: true,
  paymentReference: true,
  total: true,
  items: {
    orderBy: { branchInventoryId: 'asc' },
    select: {
      id: true,
      branchInventoryId: true,
      productId: true,
      merchantId: true,
      productName: true,
      sku: true,
      barcode: true,
      merchantName: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
    },
  },
} satisfies Prisma.SaleSelect;

export type CompletedSaleRecord = Prisma.SaleGetPayload<{
  select: typeof completedSaleSelect;
}>;
export function completedSaleResponse(sale: CompletedSaleRecord) {
  return {
    id: sale.id,
    organizationId: sale.organizationId,
    branchId: sale.branchId,
    receiptCode: sale.receiptCode,
    completedAt: sale.completedAt,
    organizationName: sale.organizationName,
    branchName: sale.branchName,
    branchCode: sale.branchCode,
    cashierName: sale.cashierName,
    paymentMethod: sale.paymentMethod,
    paymentReference: sale.paymentReference,
    total: sale.total.toFixed(2),
    cashTender: sale.cashTender?.toFixed(2) ?? null,
    cashChange: sale.cashChange?.toFixed(2) ?? null,
    items: sale.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
    })),
  };
}
