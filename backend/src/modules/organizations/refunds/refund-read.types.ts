import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '../../../generated/prisma/client';
import { CompletedRefundResponseDto } from './refunds.types';
const Exact = Prisma.Decimal.clone({ precision: 40 });
export class MerchantRefundItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() saleItemId!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty({ type: String, nullable: true }) sku!: string | null;
  @ApiProperty({ type: String, nullable: true }) barcode!: string | null;
  @ApiProperty() merchantName!: string;
  @ApiProperty({ type: 'integer' }) quantity!: number;
  @ApiProperty({ type: 'integer' }) restockQuantity!: number;
  @ApiProperty({ example: '12.50' }) unitPrice!: string;
  @ApiProperty({ example: '25.00' }) lineTotal!: string;
}
export class MerchantRefundResponseDto {
  @ApiProperty({ enum: ['MERCHANT'] }) scope!: 'MERCHANT';
  @ApiProperty() id!: string;
  @ApiProperty() saleId!: string;
  @ApiProperty() receiptCode!: string;
  @ApiProperty() refundCode!: string;
  @ApiProperty({ type: String, format: 'date-time' }) completedAt!: Date;
  @ApiProperty() branchId!: string;
  @ApiProperty() branchName!: string;
  @ApiProperty({ type: String, nullable: true }) branchCode!: string | null;
  @ApiProperty({ example: '25.00' }) ownItemsSubtotal!: string;
  @ApiProperty({ type: [MerchantRefundItemResponseDto] })
  items!: MerchantRefundItemResponseDto[];
}
export class RefundRemainingItemResponseDto {
  @ApiProperty() saleItemId!: string;
  @ApiProperty({ type: 'integer' }) soldQuantity!: number;
  @ApiProperty({ type: 'integer' }) returnedQuantity!: number;
  @ApiProperty({ type: 'integer' }) restockedQuantity!: number;
  @ApiProperty({ type: 'integer' }) remainingQuantity!: number;
}
class RefundPageDto {
  @ApiProperty({ type: 'integer' }) page!: number;
  @ApiProperty({ type: 'integer' }) limit!: number;
  @ApiProperty({ type: 'integer' }) total!: number;
  @ApiProperty({ type: 'integer' }) totalPages!: number;
  @ApiProperty({ type: [RefundRemainingItemResponseDto] })
  remainingItems!: RefundRemainingItemResponseDto[];
}
export class StaffRefundPageDto extends RefundPageDto {
  @ApiProperty({ enum: ['STAFF'] }) scope!: 'STAFF';
  @ApiProperty({ type: [CompletedRefundResponseDto] })
  items!: CompletedRefundResponseDto[];
}
export class MerchantRefundPageDto extends RefundPageDto {
  @ApiProperty({ enum: ['MERCHANT'] }) scope!: 'MERCHANT';
  @ApiProperty({ type: [MerchantRefundResponseDto] })
  items!: MerchantRefundResponseDto[];
}
export function merchantRefundSelect(
  organizationId: string,
  branchId: string,
  saleId: string,
  merchantId: string,
) {
  return {
    id: true,
    saleId: true,
    refundCode: true,
    completedAt: true,
    sale: {
      select: {
        receiptCode: true,
        branchId: true,
        branchName: true,
        branchCode: true,
      },
    },
    items: {
      where: { organizationId, branchId, saleId, merchantId },
      orderBy: { saleItemId: 'asc' },
      select: {
        id: true,
        saleItemId: true,
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
}
export function merchantRefundResponse(
  refund: Prisma.RefundGetPayload<{
    select: ReturnType<typeof merchantRefundSelect>;
  }>,
): MerchantRefundResponseDto {
  return {
    scope: 'MERCHANT',
    id: refund.id,
    saleId: refund.saleId,
    refundCode: refund.refundCode,
    completedAt: refund.completedAt,
    ...refund.sale,
    ownItemsSubtotal: refund.items
      .reduce((sum, item) => sum.plus(item.lineTotal.toString()), new Exact(0))
      .toFixed(2),
    items: refund.items.map((item) => ({
      id: item.id,
      saleItemId: item.saleItemId,
      ...item.saleItem,
      quantity: item.quantity,
      restockQuantity: item.restockQuantity,
      unitPrice: item.unitPrice.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
    })),
  };
}
