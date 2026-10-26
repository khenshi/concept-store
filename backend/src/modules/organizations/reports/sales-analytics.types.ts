import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MerchantSalesReportResponseDto,
  StaffSalesReportResponseDto,
} from './reports.types';
import { BranchIdentityResponseDto } from '../../../openapi/response.dto';
import { SalesRankingSortBy } from './dto/sales-report-query.dto';
import type { ReportGranularity } from './report-period';

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
    description:
      'Asia/Manila bucket start (daily date, month first, or January 1); first bucket may precede from; metrics are clipped to exact bounds',
  })
  date!: string;
  @ApiProperty(integer) transactionCount!: string;
  @ApiProperty(integer) refundCount!: string;
}
export class StaffHourlyTrendDto extends StaffAnalyticsMetricsDto {
  @ApiProperty({
    minimum: 0,
    maximum: 23,
    description: 'Asia/Manila hour of day, from 0 through 23',
  })
  hour!: number;
  @ApiProperty(integer) transactionCount!: string;
  @ApiProperty(integer) refundCount!: string;
}
export class MerchantDailyTrendDto extends MerchantAnalyticsMetricsDto {
  @ApiProperty({
    format: 'date',
    description:
      'Asia/Manila bucket start (daily date, month first, or January 1); exact bounds clip metrics',
  })
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
export class StaffSalesAnalyticsResponseDto extends StaffSalesReportResponseDto {
  @ApiPropertyOptional({
    enum: ['DAY', 'MONTH', 'YEAR'],
    description:
      'Omitted for unchanged <=366-day responses; MONTH over 366 days, YEAR beyond five calendar years. At most 367 daily, 61 monthly or 8100 yearly buckets.',
  })
  granularity?: ReportGranularity;
  @ApiProperty({ type: [StaffDailyTrendDto], minItems: 1, maxItems: 8100 })
  dailyTrends!: StaffDailyTrendDto[];
  @ApiPropertyOptional({
    type: [StaffHourlyTrendDto],
    minItems: 24,
    maxItems: 24,
    description:
      'Zero-filled Asia/Manila hourly trends, returned when the selected period covers one calendar day',
  })
  hourlyTrends?: StaffHourlyTrendDto[];
  @ApiProperty({
    type: [StaffTopProductDto],
    maxItems: 15,
    description:
      'Gross descending, units descending, product ID ascending; includes refund-only products',
  })
  topProducts!: StaffTopProductDto[];
  @ApiProperty({
    ...integer,
    description: 'All distinct contributing products, not just the top fifteen',
  })
  totalProducts!: string;
  @ApiProperty({
    type: [StaffTopMerchantDto],
    maxItems: 10,
    description:
      'Gross descending, merchant ID ascending; grouped by saved merchant ID',
  })
  topMerchants!: StaffTopMerchantDto[];
}
export class MerchantSalesAnalyticsResponseDto extends MerchantSalesReportResponseDto {
  @ApiPropertyOptional({
    enum: ['DAY', 'MONTH', 'YEAR'],
    description:
      'Omitted for <=366-day responses; MONTH over 366 days, YEAR beyond five calendar years; calendar bucket starts with exact clipped metrics',
  })
  granularity?: ReportGranularity;
  @ApiProperty({ type: [MerchantDailyTrendDto], minItems: 1, maxItems: 8100 })
  dailyTrends!: MerchantDailyTrendDto[];
  @ApiProperty({ type: [MerchantTopProductDto], maxItems: 15 })
  topProducts!: MerchantTopProductDto[];
  @ApiProperty(integer) totalProducts!: string;
}
class SalesRankingPageResponseDto {
  @ApiProperty({ type: BranchIdentityResponseDto })
  branch!: BranchIdentityResponseDto;
  @ApiProperty({ format: 'date-time' }) from!: string;
  @ApiProperty({ format: 'date-time' }) until!: string;
  @ApiProperty({ enum: SalesRankingSortBy })
  sortBy!: SalesRankingSortBy;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  merchantId!: string | null;
  @ApiProperty({ type: 'integer', minimum: 1 }) page!: number;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 15, example: 15 })
  limit!: number;
  @ApiProperty({
    ...integer,
    description: 'All distinct contributing products in the applied period',
  })
  totalProducts!: string;
  @ApiProperty({ type: 'integer', minimum: 0 })
  totalPages!: number;
  @ApiProperty({ description: 'Whether another page follows this page' })
  hasNext!: boolean;
}
export class StaffSalesRankingPageResponseDto extends SalesRankingPageResponseDto {
  @ApiProperty({ enum: ['STAFF'] }) scope!: 'STAFF';
  @ApiProperty({ type: [StaffTopProductDto], maxItems: 15 })
  items!: StaffTopProductDto[];
}
export class MerchantSalesRankingPageResponseDto extends SalesRankingPageResponseDto {
  @ApiProperty({ enum: ['MERCHANT'] }) scope!: 'MERCHANT';
  @ApiProperty({ type: [MerchantTopProductDto], maxItems: 15 })
  items!: MerchantTopProductDto[];
}
export type SalesAnalytics =
  StaffSalesAnalyticsResponseDto | MerchantSalesAnalyticsResponseDto;
export type SalesRankingPage =
  StaffSalesRankingPageResponseDto | MerchantSalesRankingPageResponseDto;

class DailyReportPageResponseDto {
  @ApiProperty({ type: BranchIdentityResponseDto })
  branch!: BranchIdentityResponseDto;
  @ApiProperty({ format: 'date-time' }) from!: string;
  @ApiProperty({ format: 'date-time' }) until!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) page!: number;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 }) limit!: number;
  @ApiProperty({
    type: 'integer',
    description:
      'Number of intersecting Manila dates, including zero-activity days',
  })
  total!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) totalPages!: number;
}

export class StaffDailyReportPageResponseDto extends DailyReportPageResponseDto {
  @ApiProperty({ enum: ['STAFF'] }) scope!: 'STAFF';
  @ApiProperty({ type: [StaffDailyTrendDto], maxItems: 100 })
  items!: StaffDailyTrendDto[];
}

export class MerchantDailyReportPageResponseDto extends DailyReportPageResponseDto {
  @ApiProperty({ enum: ['MERCHANT'] }) scope!: 'MERCHANT';
  @ApiProperty({ type: [MerchantDailyTrendDto], maxItems: 100 })
  items!: MerchantDailyTrendDto[];
}

export type DailyReportPage =
  StaffDailyReportPageResponseDto | MerchantDailyReportPageResponseDto;
