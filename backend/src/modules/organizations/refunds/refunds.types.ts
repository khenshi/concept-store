import { ApiProperty } from '@nestjs/swagger';
import { Prisma, SalePaymentMethod } from '../../../generated/prisma/client';
export class RefundItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() saleItemId!: string;
  @ApiProperty() branchInventoryId!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() merchantId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty({ type: String, nullable: true }) sku!: string | null;
  @ApiProperty({ type: String, nullable: true }) barcode!: string | null;
  @ApiProperty() merchantName!: string;
  @ApiProperty({ type: 'integer' }) quantity!: number;
  @ApiProperty({ type: 'integer' }) restockQuantity!: number;
  @ApiProperty({ example: '12.50' }) unitPrice!: string;
  @ApiProperty({ example: '25.00' }) lineTotal!: string;
}
export class CompletedRefundResponseDto {
  @ApiProperty({ enum: ['STAFF'] }) scope!: 'STAFF';
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() saleId!: string;
  @ApiProperty() receiptCode!: string;
  @ApiProperty() refundCode!: string;
  @ApiProperty({ type: String, format: 'date-time' }) completedAt!: Date;
  @ApiProperty() reason!: string;
  @ApiProperty({ enum: SalePaymentMethod }) paymentMethod!: SalePaymentMethod;
  @ApiProperty({ type: String, nullable: true }) paymentReference!:
    string | null;
  @ApiProperty({ example: '25.00' }) total!: string;
  @ApiProperty({ type: [RefundItemResponseDto] })
  items!: RefundItemResponseDto[];
}
export const completedRefundSelect = {
  id: true,
  organizationId: true,
  branchId: true,
  saleId: true,
  refundCode: true,
  completedAt: true,
  reason: true,
  paymentMethod: true,
  paymentReference: true,
  total: true,
  sale: { select: { receiptCode: true } },
  items: {
    orderBy: { saleItemId: 'asc' },
    select: {
      id: true,
      saleItemId: true,
      branchInventoryId: true,
      merchantId: true,
      quantity: true,
      restockQuantity: true,
      unitPrice: true,
      lineTotal: true,
      saleItem: {
        select: {
          productId: true,
          productName: true,
          sku: true,
          barcode: true,
          merchantName: true,
        },
      },
    },
  },
} satisfies Prisma.RefundSelect;
export function completedRefundResponse(
  refund: Prisma.RefundGetPayload<{ select: typeof completedRefundSelect }>,
): CompletedRefundResponseDto {
  return {
    scope: 'STAFF',
    id: refund.id,
    organizationId: refund.organizationId,
    branchId: refund.branchId,
    saleId: refund.saleId,
    receiptCode: refund.sale.receiptCode,
    refundCode: refund.refundCode,
    completedAt: refund.completedAt,
    reason: refund.reason,
    paymentMethod: refund.paymentMethod,
    paymentReference: refund.paymentReference,
    total: refund.total.toFixed(2),
    items: refund.items.map((item) => ({
      id: item.id,
      saleItemId: item.saleItemId,
      branchInventoryId: item.branchInventoryId,
      merchantId: item.merchantId,
      ...item.saleItem,
      quantity: item.quantity,
      restockQuantity: item.restockQuantity,
      unitPrice: item.unitPrice.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
    })),
  };
}
