import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, Matches, ValidateIf } from 'class-validator';
import { SettlementSchedule } from '../../../generated/prisma/client';
import { trimOptionalDecimal } from './agreement-dto.transforms';
import {
  COMMISSION_PATTERN,
  POSITIVE_MONEY_PATTERN,
} from './create-merchant-agreement.dto';

export class UpdateMerchantAgreementDto {
  @ApiPropertyOptional({ format: 'date', example: '2026-09-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must use YYYY-MM-DD format',
  })
  startDate?: string;

  @ApiPropertyOptional({
    format: 'date',
    nullable: true,
    example: '2027-08-31',
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must use YYYY-MM-DD format',
  })
  endDate?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '2500.00' })
  @Transform(trimOptionalDecimal)
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Matches(POSITIVE_MONEY_PATTERN, {
    message:
      'fixedRentAmount must be a positive amount with at most 2 decimals',
  })
  fixedRentAmount?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '5.00' })
  @Transform(trimOptionalDecimal)
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Matches(COMMISSION_PATTERN, {
    message: 'commissionRate must be between 0 and 100 with at most 2 decimals',
  })
  commissionRate?: string | null;

  @ApiPropertyOptional({ enum: SettlementSchedule })
  @IsOptional()
  @IsEnum(SettlementSchedule)
  settlementSchedule?: SettlementSchedule;
}
