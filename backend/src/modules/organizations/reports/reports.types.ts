import { ApiProperty } from '@nestjs/swagger';
import { BranchIdentityResponseDto } from '../../../openapi/response.dto';

export class ReportPaymentResponseDto {
  @ApiProperty({
    enum: ['CASH', 'GCASH', 'CARD'],
    description:
      'Original gross sale method; GCASH and CARD are manual, unverified payments',
  })
  paymentMethod!: 'CASH' | 'GCASH' | 'CARD';
  @ApiProperty({
    example: '125.00',
    description: 'Exact two-decimal PHP gross recorded sales; not cash tender',
  })
  grossSales!: string;
  @ApiProperty({
    example: '2',
    pattern: '^\\d+$',
    description: 'Nonnegative integer string',
  })
  transactionCount!: string;
}

class ReportScopeResponseDto {
  @ApiProperty({ type: BranchIdentityResponseDto })
  branch!: BranchIdentityResponseDto;
  @ApiProperty({
    format: 'date-time',
    description: 'Applied inclusive UTC completion timestamp',
  })
  from!: string;
  @ApiProperty({
    format: 'date-time',
    description: 'Applied exclusive UTC completion timestamp',
  })
  until!: string;
}

export class ReportRefundMethodResponseDto {
  @ApiProperty({
    enum: ['CASH', 'GCASH', 'CARD'],
    description:
      'Actual manual refund method, independent of original sale method',
  })
  paymentMethod!: 'CASH' | 'GCASH' | 'CARD';
  @ApiProperty({ example: '25.00' }) refundedAmount!: string;
  @ApiProperty({ example: '1', pattern: '^\\d+$' }) refundCount!: string;
}

export class StaffSalesReportResponseDto extends ReportScopeResponseDto {
  @ApiProperty({ enum: ['STAFF'] })
  scope!: 'STAFF';
  @ApiProperty({
    example: '125.00',
    description:
      'Exact two-decimal PHP gross recorded sales, not profit or payouts',
  })
  grossSales!: string;
  @ApiProperty({ example: '2', pattern: '^\\d+$' })
  transactionCount!: string;
  @ApiProperty({ example: '4', pattern: '^\\d+$' })
  unitsSold!: string;
  @ApiProperty({
    type: ReportPaymentResponseDto,
    description:
      'Gross sale payments only; never netted against refund methods',
    isArray: true,
    minItems: 3,
    maxItems: 3,
  })
  payments!: ReportPaymentResponseDto[];
  @ApiProperty({
    example: '25.00',
    description:
      'Exact PHP refunded amount recognized on refund completion date',
  })
  refundedAmount!: string;
  @ApiProperty({ example: '1', pattern: '^\\d+$' }) refundCount!: string;
  @ApiProperty({ example: '2', pattern: '^\\d+$' }) returnedUnits!: string;
  @ApiProperty({
    example: '-25.00',
    description:
      'Exact signed gross minus refunds; may be negative, not profit or available cash',
  })
  netRecordedSales!: string;
  @ApiProperty({
    type: [ReportRefundMethodResponseDto],
    description:
      'Separate actual refund methods, not available cash or provider reconciliation',
    minItems: 3,
    maxItems: 3,
  })
  refundMethods!: ReportRefundMethodResponseDto[];
}

export class MerchantSalesReportResponseDto extends ReportScopeResponseDto {
  @ApiProperty({ enum: ['MERCHANT'] })
  scope!: 'MERCHANT';
  @ApiProperty({
    example: '75.00',
    description: 'Exact PHP sum of own historical item amounts only',
  })
  ownGrossSales!: string;
  @ApiProperty({
    example: '2',
    pattern: '^\\d+$',
    description: 'Distinct sales containing own items only',
  })
  ownTransactionCount!: string;
  @ApiProperty({ example: '3', pattern: '^\\d+$' })
  ownUnitsSold!: string;
  @ApiProperty({ example: '25.00' }) ownRefundedAmount!: string;
  @ApiProperty({
    example: '1',
    pattern: '^\\d+$',
    description: 'Distinct refunds containing own items only',
  })
  ownRefundCount!: string;
  @ApiProperty({ example: '2', pattern: '^\\d+$' }) ownReturnedUnits!: string;
  @ApiProperty({
    example: '-25.00',
    description: 'Exact signed own gross minus own refunds',
  })
  ownNetRecordedSales!: string;
}

export type SalesReport =
  StaffSalesReportResponseDto | MerchantSalesReportResponseDto;
