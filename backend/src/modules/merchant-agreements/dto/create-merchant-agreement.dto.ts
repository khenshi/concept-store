import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  RentDueWeek,
  RentDueWeekday,
  SettlementSchedule,
} from '../../../generated/prisma/client';
import { trimOptionalDecimal } from './agreement-dto.transforms';

export const POSITIVE_MONEY_PATTERN =
  /^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,9}(?:\.\d{1,2})?)$/;
export const COMMISSION_PATTERN =
  /^(?:100(?:\.0{1,2})?|[1-9]\d?(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/;

export class CreateMerchantAgreementDto {
  @ApiProperty({ format: 'date', example: '2026-09-10' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'activationAt must use YYYY-MM-DD format',
  })
  activationAt!: string;

  @ApiProperty({ minimum: 1, maximum: 60, example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  durationMonths!: number;

  @ApiProperty({ type: [String], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  spaceIds!: string[];

  @ApiPropertyOptional({ type: String })
  @Transform(trimOptionalDecimal)
  @IsOptional()
  @Matches(POSITIVE_MONEY_PATTERN)
  fixedRentAmount?: string;

  @ApiPropertyOptional({ type: String })
  @Transform(trimOptionalDecimal)
  @IsOptional()
  @Matches(COMMISSION_PATTERN)
  commissionRate?: string;

  @ApiPropertyOptional({ type: String })
  @Transform(trimOptionalDecimal)
  @IsOptional()
  @Matches(POSITIVE_MONEY_PATTERN)
  securityDepositAmount?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  firstRentPaymentRequired?: boolean;

  @ApiPropertyOptional({ enum: RentDueWeek })
  @IsOptional()
  @IsEnum(RentDueWeek)
  rentDueWeek?: RentDueWeek;

  @ApiPropertyOptional({ enum: RentDueWeekday })
  @IsOptional()
  @IsEnum(RentDueWeekday)
  rentDueWeekday?: RentDueWeekday;

  @ApiProperty({ enum: SettlementSchedule })
  @IsEnum(SettlementSchedule)
  settlementSchedule!: SettlementSchedule;
}
