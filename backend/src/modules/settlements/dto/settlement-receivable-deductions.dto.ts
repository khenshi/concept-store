import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class SettlementReceivableDeductionsDto {
  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Apply the complete outstanding rent balance oldest-first when the settlement payout can cover it in full.',
  })
  @IsOptional()
  @IsBoolean()
  deductOutstandingRent?: boolean;
}
