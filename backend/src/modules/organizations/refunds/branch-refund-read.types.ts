import { ApiProperty } from '@nestjs/swagger';
import { Prisma, SalePaymentMethod } from '../../../generated/prisma/client';

export class BranchRefundSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() saleId!: string;
  @ApiProperty() receiptCode!: string;
  @ApiProperty() refundCode!: string;
  @ApiProperty({ type: String, format: 'date-time' }) completedAt!: Date;
  @ApiProperty({ enum: SalePaymentMethod }) paymentMethod!: SalePaymentMethod;
  @ApiProperty({ example: '25.00' }) total!: string;
}

export class BranchRefundPageDto {
  @ApiProperty({ enum: ['STAFF'] }) scope!: 'STAFF';
  @ApiProperty() organizationId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty({ type: 'integer' }) page!: number;
  @ApiProperty({ type: 'integer' }) limit!: number;
  @ApiProperty({ type: 'integer' }) total!: number;
  @ApiProperty({ type: 'integer' }) totalPages!: number;
  @ApiProperty({ type: [BranchRefundSummaryDto] })
  items!: BranchRefundSummaryDto[];
}

export const branchRefundSummarySelect = {
  id: true,
  saleId: true,
  refundCode: true,
  completedAt: true,
  paymentMethod: true,
  total: true,
  sale: { select: { receiptCode: true } },
} satisfies Prisma.RefundSelect;

export function branchRefundSummaryResponse(
  refund: Prisma.RefundGetPayload<{ select: typeof branchRefundSummarySelect }>,
): BranchRefundSummaryDto {
  return {
    id: refund.id,
    saleId: refund.saleId,
    receiptCode: refund.sale.receiptCode,
    refundCode: refund.refundCode,
    completedAt: refund.completedAt,
    paymentMethod: refund.paymentMethod,
    total: refund.total.toFixed(2),
  };
}
