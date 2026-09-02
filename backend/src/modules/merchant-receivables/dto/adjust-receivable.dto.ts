import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

const SIGNED_NONZERO_MONEY_PATTERN =
  /^(?:-?(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,11}(?:\.\d{1,2})?))$/;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class AdjustReceivableDto {
  @ApiProperty({ type: String, example: '-500.00' })
  @IsString()
  @Matches(SIGNED_NONZERO_MONEY_PATTERN)
  amount!: string;

  @ApiProperty({ maxLength: 500 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
