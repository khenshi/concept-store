import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, Matches } from 'class-validator';
import { SettlementSchedule } from '../../../generated/prisma/client';
import { trimOptionalDecimal } from './agreement-dto.transforms';

const POSITIVE_MONEY_PATTERN =
  /^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,9}(?:\.\d{1,2})?)$/;
const COMMISSION_PATTERN =
  /^(?:100(?:\.0{1,2})?|[1-9]\d?(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/;

export class CreateMerchantAgreementDto {
  @ApiProperty({ format: 'date', example: '2026-09-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must use YYYY-MM-DD format',
  })
  startDate!: string;

  @ApiPropertyOptional({ format: 'date', example: '2027-08-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must use YYYY-MM-DD format',
  })
  endDate?: string;

  @ApiPropertyOptional({ example: '2500.00', type: String })
  @Transform(trimOptionalDecimal)
  @IsOptional()
  @Matches(POSITIVE_MONEY_PATTERN, {
    message:
      'fixedRentAmount must be a positive amount with at most 2 decimals',
  })
  fixedRentAmount?: string;

  @ApiPropertyOptional({ example: '5.00', type: String })
  @Transform(trimOptionalDecimal)
  @IsOptional()
  @Matches(COMMISSION_PATTERN, {
    message: 'commissionRate must be between 0 and 100 with at most 2 decimals',
  })
  commissionRate?: string;

  @ApiProperty({ enum: SettlementSchedule })
  @IsEnum(SettlementSchedule)
  settlementSchedule!: SettlementSchedule;
}

export { COMMISSION_PATTERN, POSITIVE_MONEY_PATTERN };
