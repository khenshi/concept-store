import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
  ValidateIf,
} from 'class-validator';
import {
  trimOptionalString,
  trimRequiredString,
} from './inventory-dto.transforms';

export class AdjustInventoryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  branchId!: string;

  @ApiPropertyOptional({
    example: -2,
    minimum: -1000000000,
    maximum: 1000000000,
  })
  @ValidateIf((input: AdjustInventoryDto) => input.newQuantity === undefined)
  @IsOptional()
  @IsInt()
  @Min(-1_000_000_000)
  @Max(1_000_000_000)
  @NotEquals(0)
  quantityChange?: number;

  @ApiPropertyOptional({ example: 24, minimum: 0, maximum: 1000000000 })
  @ValidateIf((input: AdjustInventoryDto) => input.quantityChange === undefined)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  newQuantity?: number;

  @ApiProperty({ example: 'Physical count correction', maxLength: 500 })
  @Transform(trimRequiredString)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  note!: string;

  @ApiPropertyOptional({ example: 'COUNT-2026-08-26', maxLength: 120 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceId?: string;
}
