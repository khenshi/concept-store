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
import { PaymentMethod } from '../../../generated/prisma/client';
const trimOptional = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed || undefined;
};

export class RecordReceivablePaymentDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(trimOptional)
  @ValidateIf(
    (dto: RecordReceivablePaymentDto) => dto.method !== PaymentMethod.CASH,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  referenceNumber?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true, strictSeparator: true })
  paidAt!: string;
}
