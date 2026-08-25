import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class EndMerchantAgreementDto {
  @ApiProperty({ format: 'date', example: '2027-08-31' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must use YYYY-MM-DD format',
  })
  endDate!: string;
}
