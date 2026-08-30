import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { SettlementStatus } from '../../../generated/prisma/client';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ListSettlementsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  merchantId?: string;

  @ApiPropertyOptional({ enum: SettlementStatus })
  @IsOptional()
  @IsEnum(SettlementStatus)
  status?: SettlementStatus;

  @ApiPropertyOptional({ format: 'date', description: 'Earliest period start' })
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY_PATTERN, { message: 'periodFrom must be an ISO date' })
  periodFrom?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Latest period end' })
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY_PATTERN, { message: 'periodTo must be an ISO date' })
  periodTo?: string;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}
