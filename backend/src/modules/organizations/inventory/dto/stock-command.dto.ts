import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsDefined,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  NotEquals,
  ValidateIf,
} from 'class-validator';

type AdjustmentInputShape = {
  quantityChange?: unknown;
  newQuantity?: unknown;
};

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

  @ApiPropertyOptional({
    type: 'integer',
    minimum: -2147483648,
    maximum: 2147483647,
    description: 'Nonzero signed stock delta',
  })
  @ValidateIf(
    (object: AdjustmentInputShape) => object.newQuantity === undefined,
  )
  @IsDefined()
  @IsInt()
  @Min(-2147483648)
  @Max(2147483647)
  @NotEquals(0)
  quantityChange?: number;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 0,
    maximum: 2147483647,
    description:
      'Absolute resulting stock value; use instead of quantityChange',
  })
  @ValidateIf(
    (object: AdjustmentInputShape) => object.quantityChange === undefined,
  )
  @IsDefined()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  newQuantity?: number;
}
