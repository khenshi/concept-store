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
  Max,
  Min,
} from 'class-validator';
import {
  trimOptionalString,
  trimRequiredString,
} from '../../products/dto/product-dto.transforms';

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
      'Exclusive UTC completion timestamp ending in Z; required, after from and within 366 days',
  })
  @Transform(trimRequiredString)
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
  until!: string;
}

export class ReportBranchesQueryDto {}

export enum SalesRankingSortBy {
  GROSS_SALES = 'GROSS_SALES',
  UNITS_SOLD = 'UNITS_SOLD',
}

const queryInteger = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class SalesRankingQueryDto extends SalesReportQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 21474836,
    default: 1,
    description: 'One-based product ranking page; each page contains ten rows',
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
