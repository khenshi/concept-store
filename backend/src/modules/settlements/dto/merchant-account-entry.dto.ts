import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  Equals,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MerchantAccountEntryType } from '../../../generated/prisma/client';

const SIGNED_NONZERO_MONEY_PATTERN =
  /^(?:-?(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,11}(?:\.\d{1,2})?))$/;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class MerchantAccountEntryDto {
  @ApiProperty({ enum: [MerchantAccountEntryType.ADJUSTMENT] })
  @Equals(MerchantAccountEntryType.ADJUSTMENT)
  type!: MerchantAccountEntryType;

  @ApiProperty({ type: String, example: '-500.00' })
  @Transform(trim)
  @IsString()
  @Matches(SIGNED_NONZERO_MONEY_PATTERN, {
    message: 'amount must be nonzero with at most 2 decimals',
  })
  amount!: string;

  @ApiProperty({ maxLength: 500, example: 'Documented balance correction' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
