import { ApiProperty } from '@nestjs/swagger';
import {
  MerchantSalesReportResponseDto,
  StaffSalesReportResponseDto,
} from './reports.types';

const money = { type: String, pattern: '^(0|[1-9][0-9]*)\\.[0-9]{2}$' };
const integer = { type: String, pattern: '^(0|[1-9][0-9]*)$' };
const signed = {
  type: String,
  pattern: '^-?(0|[1-9][0-9]*)\\.[0-9]{2}$',
  description: 'Exact signed PHP gross minus refunds; never negative zero',
};

export class StaffAnalyticsMetricsDto {
  @ApiProperty(money) grossSales!: string;
  @ApiProperty(integer) unitsSold!: string;
  @ApiProperty(money) refundedAmount!: string;
  @ApiProperty(integer) returnedUnits!: string;
  @ApiProperty(signed) netRecordedSales!: string;
}
export class MerchantAnalyticsMetricsDto {
  @ApiProperty(money) ownGrossSales!: string;
  @ApiProperty(integer) ownUnitsSold!: string;
  @ApiProperty(money) ownRefundedAmount!: string;
  @ApiProperty(integer) ownReturnedUnits!: string;
  @ApiProperty(signed) ownNetRecordedSales!: string;
}
export class StaffDailyTrendDto extends StaffAnalyticsMetricsDto {
  @ApiProperty({
    format: 'date',
    description: 'Asia/Manila date; exact instant filtering precedes bucketing',
  })
  date!: string;
  @ApiProperty(integer) transactionCount!: string;
  @ApiProperty(integer) refundCount!: string;
}
export class MerchantDailyTrendDto extends MerchantAnalyticsMetricsDto {
  @ApiProperty({ format: 'date', description: 'Asia/Manila date' })
  date!: string;
  @ApiProperty(integer) ownTransactionCount!: string;
  @ApiProperty(integer) ownRefundCount!: string;
}
export class SavedProductIdentityDto {
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty({
    description:
      'Latest contributing original sale-item snapshot, not live catalog',
  })
  productName!: string;
  @ApiProperty({ type: String, nullable: true }) sku!: string | null;
  @ApiProperty({ type: String, nullable: true }) barcode!: string | null;
  @ApiProperty() merchantName!: string;
}
export class StaffTopProductDto extends SavedProductIdentityDto {
  @ApiProperty(money) grossSales!: string;
  @ApiProperty(integer) unitsSold!: string;
  @ApiProperty(money) refundedAmount!: string;
  @ApiProperty(integer) returnedUnits!: string;
  @ApiProperty(signed) netRecordedSales!: string;
}
export class MerchantTopProductDto extends SavedProductIdentityDto {
  @ApiProperty(money) ownGrossSales!: string;
  @ApiProperty(integer) ownUnitsSold!: string;
  @ApiProperty(money) ownRefundedAmount!: string;
  @ApiProperty(integer) ownReturnedUnits!: string;
  @ApiProperty(signed) ownNetRecordedSales!: string;
}
export class StaffTopMerchantDto {
  @ApiProperty({ format: 'uuid' }) merchantId!: string;
  @ApiProperty({
    description:
      'Latest contributing saved merchant name by sale completion time, then sale-item ID',
  })
  merchantName!: string;
  @ApiProperty({
    ...money,
    description: 'Gross sales summed from matching saved sale items',
  })
  grossSales!: string;
}
export class StaffNetByPaymentMethodDto {
  @ApiProperty({
    enum: ['CASH', 'GCASH', 'CARD'],
    description: 'Original sale payment method for matching net sales',
  })
  paymentMethod!: 'CASH' | 'GCASH' | 'CARD';
  @ApiProperty({
    ...signed,
    description:
      'Gross sales less refunds processed in the selected period, attributed to the original sale method',
  })
  netRecordedSales!: string;
}
export class StaffSalesAnalyticsResponseDto extends StaffSalesReportResponseDto {
  @ApiProperty({ type: [StaffDailyTrendDto], minItems: 1, maxItems: 367 })
  dailyTrends!: StaffDailyTrendDto[];
  @ApiProperty({
    type: [StaffTopProductDto],
    maxItems: 10,
    description:
      'Gross descending, units descending, product ID ascending; includes refund-only products',
  })
  topProducts!: StaffTopProductDto[];
  @ApiProperty({
    ...integer,
    description: 'All distinct contributing products, not just the top ten',
  })
  totalProducts!: string;
  @ApiProperty({
    type: [StaffTopMerchantDto],
    maxItems: 10,
    description:
      'Gross descending, merchant ID ascending; grouped by saved merchant ID',
  })
  topMerchants!: StaffTopMerchantDto[];
  @ApiProperty({
    type: [StaffNetByPaymentMethodDto],
    minItems: 3,
    maxItems: 3,
    description:
      'Fixed method totals; refunds are attributed to the original sale payment method and amounts reconcile to netRecordedSales',
  })
  netByPaymentMethod!: StaffNetByPaymentMethodDto[];
}
export class MerchantSalesAnalyticsResponseDto extends MerchantSalesReportResponseDto {
  @ApiProperty({ type: [MerchantDailyTrendDto], minItems: 1, maxItems: 367 })
  dailyTrends!: MerchantDailyTrendDto[];
  @ApiProperty({ type: [MerchantTopProductDto], maxItems: 10 })
  topProducts!: MerchantTopProductDto[];
  @ApiProperty(integer) totalProducts!: string;
}
export type SalesAnalytics =
  StaffSalesAnalyticsResponseDto | MerchantSalesAnalyticsResponseDto;
