import { ReportPaymentAccountDto } from './payment-account-aggregates';
import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { BranchIdentityResponseDto } from '../../../openapi/response.dto';

class ReportScopeResponseDto {
  @ApiPropertyOptional({ type: BranchIdentityResponseDto })
  branch?: BranchIdentityResponseDto;
  @ApiPropertyOptional({ enum: ['ALL'] }) reportScope?: 'ALL';
  @ApiPropertyOptional({ type: 'integer', minimum: 0 }) branchCount?: number;
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
    type: [ReportPaymentAccountDto],
    description:
      'Complete account flows; no truncation or account balance claim',
  })
  paymentAccounts!: ReportPaymentAccountDto[];
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

class TransactionResponseBaseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) saleId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  refundId!: string | null;
  @ApiProperty({ format: 'date-time' }) completedAt!: Date;
  @ApiProperty({ description: 'Receipt or refund code' }) reference!: string;
  @ApiProperty({ example: '125.00' }) amount!: string;
  @ApiPropertyOptional({ type: BranchIdentityResponseDto })
  branch?: BranchIdentityResponseDto;
}

export class StaffSaleTransactionResponseDto extends TransactionResponseBaseDto {
  @ApiProperty({ enum: ['SALE'] }) type!: 'SALE';
  @ApiProperty({ format: 'uuid' }) paymentAccountId!: string;
  @ApiProperty() paymentAccountName!: string;
  @ApiProperty() paymentAccountIsCash!: boolean;
  @ApiProperty() paymentAccountRequiresReference!: boolean;
  @ApiProperty({ description: 'Saved cashier display name' })
  actorName!: string;
  @ApiProperty({ type: [String] }) merchantNames!: string[];
}

export class StaffRefundTransactionResponseDto extends TransactionResponseBaseDto {
  @ApiProperty({ enum: ['REFUND'] }) type!: 'REFUND';
  @ApiProperty({ format: 'uuid' }) paymentAccountId!: string;
  @ApiProperty() paymentAccountName!: string;
  @ApiProperty() paymentAccountIsCash!: boolean;
  @ApiProperty() paymentAccountRequiresReference!: boolean;
  @ApiProperty({ description: 'Saved refund actor display name' })
  actorName!: string;
  @ApiProperty({ type: [String] }) merchantNames!: string[];
}

export class MerchantSaleTransactionResponseDto extends TransactionResponseBaseDto {
  @ApiProperty({ enum: ['SALE'] }) type!: 'SALE';
}

export class MerchantRefundTransactionResponseDto extends TransactionResponseBaseDto {
  @ApiProperty({ enum: ['REFUND'] }) type!: 'REFUND';
}

class TransactionsPageResponseDto {
  @ApiPropertyOptional({ type: BranchIdentityResponseDto })
  branch?: BranchIdentityResponseDto;
  @ApiPropertyOptional({ enum: ['ALL'] }) reportScope?: 'ALL';
  @ApiPropertyOptional({ type: 'integer', minimum: 0 }) branchCount?: number;
  @ApiProperty({ format: 'date-time' }) from!: string;
  @ApiProperty({ format: 'date-time' }) until!: string;
  @ApiProperty({ type: 'integer' }) page!: number;
  @ApiProperty({ type: 'integer' }) limit!: number;
  @ApiProperty({ type: 'integer' }) total!: number;
  @ApiProperty({ type: 'integer' }) totalPages!: number;
}

export class StaffTransactionsPageResponseDto extends TransactionsPageResponseDto {
  @ApiProperty({ enum: ['STAFF'] }) scope!: 'STAFF';
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(StaffSaleTransactionResponseDto) },
        { $ref: getSchemaPath(StaffRefundTransactionResponseDto) },
      ],
    },
  })
  items!: (
    StaffSaleTransactionResponseDto | StaffRefundTransactionResponseDto
  )[];
}

export class MerchantTransactionsPageResponseDto extends TransactionsPageResponseDto {
  @ApiProperty({ enum: ['MERCHANT'] }) scope!: 'MERCHANT';
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(MerchantSaleTransactionResponseDto) },
        { $ref: getSchemaPath(MerchantRefundTransactionResponseDto) },
      ],
    },
  })
  items!: (
    MerchantSaleTransactionResponseDto | MerchantRefundTransactionResponseDto
  )[];
}

export type ReportTransactionItem =
  | StaffSaleTransactionResponseDto
  | StaffRefundTransactionResponseDto
  | MerchantSaleTransactionResponseDto
  | MerchantRefundTransactionResponseDto;
export type TransactionsPage =
  StaffTransactionsPageResponseDto | MerchantTransactionsPageResponseDto;
