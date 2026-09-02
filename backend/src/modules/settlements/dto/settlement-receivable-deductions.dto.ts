import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

const POSITIVE_MONEY_PATTERN =
  /^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,11}(?:\.\d{1,2})?)$/;

export class SettlementReceivableDeductionsDto {
  @ApiPropertyOptional({
    type: String,
    example: '2500.00',
    description:
      'Total accumulated rent to apply oldest-first. Omit to leave rent separate.',
  })
  @IsOptional()
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, {
    message: 'rentDeductionAmount must be positive with at most 2 decimals',
  })
  rentDeductionAmount?: string;
}
