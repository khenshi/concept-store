import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import {
  trimOptionalString,
  trimRequiredString,
} from '../../products/dto/product-dto.transforms';

const queryInteger = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class SalesReportQueryDto {
  @ApiProperty({
    format: 'date-time',
    description: 'Inclusive UTC completion timestamp ending in Z; required',
  })
  @Transform(trimRequiredString)
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
  from!: string;

  @ApiProperty({
    format: 'date-time',
    description:
      'Exclusive UTC completion timestamp ending in Z; required, after from; supported Manila dates 1900-01-01 through 9999-12-30',
  })
  @Transform(trimRequiredString)
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
  until!: string;
}

export class ReportBranchesQueryDto {}

export enum ReportPeriodMode {
  ALL_TIME = 'ALL_TIME',
}

export class ReportPeriodQueryDto {
  @ApiProperty({
    enum: ReportPeriodMode,
    description: 'Explicit all-time resolution; from is forbidden',
  })
  @IsEnum(ReportPeriodMode)
  mode!: ReportPeriodMode;

  @ApiProperty({
    format: 'date-time',
    description:
      'Required frozen exclusive UTC upper bound, normally midnight after today in Manila; no implicit clock reads',
  })
  @Transform(trimRequiredString)
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
  until!: string;
}

export class DailyReportQueryDto extends SalesReportQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 21474836,
    default: 1,
  })
  @Transform(queryInteger)
  @IsInt()
  @Min(1)
  @Max(21474836)
  page = 1;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 15,
  })
  @Transform(queryInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 15;
}

export enum ReportTransactionType {
  SALE = 'SALE',
  REFUND = 'REFUND',
}

export class TransactionsQueryDto extends SalesReportQueryDto {
  @ApiPropertyOptional({
    enum: ReportTransactionType,
    description: 'Optional completed transaction type filter',
  })
  @IsOptional()
  @IsEnum(ReportTransactionType)
  type?: ReportTransactionType;

  @ApiPropertyOptional({
    maxLength: 254,
    description: 'Case-insensitive receipt or refund-code search',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(254)
  q?: string;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 21474836,
    default: 1,
    description: 'One-based transaction page',
  })
  @Transform(queryInteger)
  @IsInt()
  @Min(1)
  @Max(21474836)
  page = 1;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 15,
    description: 'Transaction rows per page',
  })
  @Transform(queryInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 15;
}

export enum SalesRankingSortBy {
  GROSS_SALES = 'GROSS_SALES',
  UNITS_SOLD = 'UNITS_SOLD',
}

export class SalesRankingQueryDto extends SalesReportQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 21474836,
    default: 1,
    description:
      'One-based product ranking page; each page contains fifteen rows',
  })
  @Transform(queryInteger)
  @IsInt()
  @Min(1)
  @Max(21474836)
  page = 1;

  @ApiPropertyOptional({
    enum: SalesRankingSortBy,
    default: SalesRankingSortBy.GROSS_SALES,
    description: 'Product ranking metric; ties use the other metric then ID',
  })
  @IsOptional()
  @IsEnum(SalesRankingSortBy)
  sortBy = SalesRankingSortBy.GROSS_SALES;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Tenant merchant filter for Owner/Manager rankings; unavailable to Merchant accounts',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsUUID('4')
  merchantId?: string;
}
