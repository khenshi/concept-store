import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  NotEquals,
} from 'class-validator';

class StockCommandDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Reuse for retries of the same stock command',
  })
  @IsUUID('4')
  requestId!: string;
}

export class ReceiveInventoryDto extends StockCommandDto {
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 2147483647 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantity!: number;
}

export class AdjustInventoryDto extends StockCommandDto {
  @ApiProperty({ minLength: 2, maxLength: 500 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 500)
  reason!: string;

  @ApiProperty({
    type: 'integer',
    minimum: -2147483648,
    maximum: 2147483647,
    description: 'Nonzero signed stock delta',
  })
  @IsInt()
  @Min(-2147483648)
  @Max(2147483647)
  @NotEquals(0)
  quantityChange!: number;
}
