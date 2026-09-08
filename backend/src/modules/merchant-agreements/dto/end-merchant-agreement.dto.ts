import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class EndMerchantAgreementDto {
  @ApiPropertyOptional({
    maxLength: 500,
    example: 'Merchant requested closure',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    format: 'date',
    example: '2027-08-31',
    deprecated: true,
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must use YYYY-MM-DD format',
  })
  endDate?: string;
}
