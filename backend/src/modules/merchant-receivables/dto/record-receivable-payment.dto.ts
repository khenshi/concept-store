import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PaymentMethod } from '../../../generated/prisma/client';

const POSITIVE_MONEY_PATTERN =
  /^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,11}(?:\.\d{1,2})?)$/;
const trimOptional = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed || undefined;
};

export class RecordReceivablePaymentDto {
  @ApiProperty({ type: String, example: '2500.00' })
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN)
  amount!: string;

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
