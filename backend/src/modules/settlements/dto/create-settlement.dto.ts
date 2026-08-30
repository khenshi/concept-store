import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches } from 'class-validator';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateSettlementDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  merchantId!: string;

  @ApiProperty({ format: 'date', example: '2026-07-01' })
  @IsString()
  @Matches(DATE_ONLY_PATTERN, { message: 'periodStart must be an ISO date' })
  periodStart!: string;

  @ApiProperty({ format: 'date', example: '2026-07-31' })
  @IsString()
  @Matches(DATE_ONLY_PATTERN, { message: 'periodEnd must be an ISO date' })
  periodEnd!: string;
}
