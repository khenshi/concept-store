import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Matches, Min } from 'class-validator';

export class SpaceAvailabilityQueryDto {
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

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  excludeAgreementId?: string;
}
