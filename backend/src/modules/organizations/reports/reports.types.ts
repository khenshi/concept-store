import { ApiProperty } from '@nestjs/swagger';
import { BranchIdentityResponseDto } from '../../../openapi/response.dto';

export class ReportPaymentResponseDto {
  @ApiProperty({
    enum: ['CASH', 'GCASH', 'CARD'],
    description: 'GCASH and CARD are manual, unverified payments',
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
    isArray: true,
    minItems: 3,
    maxItems: 3,
  })
  payments!: ReportPaymentResponseDto[];
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
}

export type SalesReport =
  StaffSalesReportResponseDto | MerchantSalesReportResponseDto;
