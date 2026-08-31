import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PayoutMethod } from '../../../generated/prisma/client';

function trimOptionalString({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class RecordPayoutDto {
  @ApiProperty({ enum: PayoutMethod })
  @IsEnum(PayoutMethod)
  method!: PayoutMethod;

  @ApiPropertyOptional({ maxLength: 120, example: 'GCASH-123456789' })
  @Transform(trimOptionalString)
  @ValidateIf((dto: RecordPayoutDto) => dto.method !== PayoutMethod.CASH)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  referenceNumber?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  note?: string;

  @ApiProperty({ format: 'date-time', example: '2026-08-31T02:30:00.000Z' })
  @IsISO8601({ strict: true, strictSeparator: true })
  paidAt!: string;
}
