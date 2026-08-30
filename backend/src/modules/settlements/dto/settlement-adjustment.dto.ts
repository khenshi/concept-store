import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

const SIGNED_NONZERO_MONEY_PATTERN =
  /^(?:-?(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,11}(?:\.\d{1,2})?))$/;

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class SettlementAdjustmentDto {
  @ApiProperty({ type: String, example: '-500.00' })
  @Transform(trimString)
  @IsString()
  @Matches(SIGNED_NONZERO_MONEY_PATTERN, {
    message: 'amount must be nonzero with at most 2 decimals',
  })
  amount!: string;

  @ApiProperty({ maxLength: 500, example: 'Prior balance correction' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
